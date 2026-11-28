-- Gig Work: a player job board.
-- The poster sets the pay, picks one applicant, and pays from their own wallet when they confirm completion.
-- Any job not completed within 24 hours expires. If the poster cannot cover the pay at confirmation, the job is cancelled.

create table if not exists public.gig_posts (
  id uuid primary key default gen_random_uuid(),
  poster_character_id uuid not null references public.characters(id),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 1000),
  pay_minor bigint not null check (pay_minor > 0),
  status text not null default 'open'
    check (status in ('open','accepted','completed','expired','cancelled')),
  accepted_worker_id uuid references public.characters(id),
  expires_at timestamptz not null default now() + interval '24 hours',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gig_worker_is_not_poster check (accepted_worker_id is distinct from poster_character_id)
);

create table if not exists public.gig_applications (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gig_posts(id) on delete cascade,
  applicant_character_id uuid not null references public.characters(id),
  offer_minor bigint check (offer_minor is null or offer_minor > 0),
  created_at timestamptz not null default now(),
  unique (gig_id, applicant_character_id)
);

create index if not exists gig_posts_status_expiry_idx on public.gig_posts (status, expires_at);
create index if not exists gig_applications_gig_idx on public.gig_applications (gig_id);

alter table public.gig_posts enable row level security;
alter table public.gig_applications enable row level security;
-- No direct client policies: all reads and writes go through the security definer functions below.

create or replace function public._gig_character(p_user_id uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.characters where user_id = p_user_id limit 1
$$;

create or replace function public._gig_move_money(p_cid uuid, p_uid uuid, p_amount bigint, p_direction text, p_label text, p_gig uuid)
returns void language plpgsql security definer set search_path=public as $$
declare w public.wallets%rowtype; after_balance bigint;
begin
  select * into w from public.wallets where character_id=p_cid and user_id=p_uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if p_direction = 'debit' then
    if w.balance < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;
    after_balance := w.balance - p_amount;
    update public.wallets set balance=after_balance, total_expenses=total_expenses+p_amount, updated_at=now() where id=w.id;
  else
    after_balance := w.balance + p_amount;
    update public.wallets set balance=after_balance, total_income=total_income+p_amount, updated_at=now() where id=w.id;
  end if;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(p_uid,w.id,p_cid,p_amount,
    case when p_direction='debit' then 'expense' else 'income' end,'game',p_label,'game','cash',
    case when p_direction='debit' then 'wallet' else 'gig_work' end,
    case when p_direction='debit' then 'gig_work' else 'wallet' end,
    after_balance, jsonb_build_object('gig_id',p_gig));
end $$;

-- Posts a job. The pay is only charged later, when the poster confirms completion.
create or replace function public.gig_post(p_user_id uuid, p_request_id uuid, p_title text, p_description text, p_pay_minor bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype;
begin
  cid := public._gig_character(p_user_id);
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into receipt from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='gig_post';
  if found then return receipt; end if;
  if p_pay_minor is null or p_pay_minor < 1 then raise exception 'INVALID_REQUEST'; end if;
  insert into public.gig_posts(poster_character_id,title,description,pay_minor)
    values(cid,trim(p_title),trim(p_description),p_pay_minor) returning * into gig;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status,'expiresAt',gig.expires_at);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_post',receipt);
  return receipt;
end $$;

-- Applies to an open job. Only possible while the job is open and no worker is picked.
create or replace function public.gig_apply(p_user_id uuid, p_request_id uuid, p_gig_id uuid, p_offer_minor bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype;
begin
  cid := public._gig_character(p_user_id);
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into receipt from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='gig_apply';
  if found then return receipt; end if;
  select * into gig from public.gig_posts where id=p_gig_id for update;
  if not found then raise exception 'GIG_NOT_FOUND'; end if;
  if gig.poster_character_id = cid then raise exception 'OWN_GIG'; end if;
  if gig.status <> 'open' or gig.expires_at <= now() then raise exception 'GIG_UNAVAILABLE'; end if;
  insert into public.gig_applications(gig_id,applicant_character_id,offer_minor)
    values(gig.id,cid,p_offer_minor)
    on conflict (gig_id, applicant_character_id) do update set offer_minor = excluded.offer_minor;
  receipt := jsonb_build_object('gigId',gig.id,'applied',true);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_apply',receipt);
  return receipt;
end $$;

-- The poster picks one applicant. No further applications are accepted after this.
create or replace function public.gig_accept(p_user_id uuid, p_request_id uuid, p_gig_id uuid, p_applicant_character_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype;
begin
  cid := public._gig_character(p_user_id);
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into receipt from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='gig_accept';
  if found then return receipt; end if;
  select * into gig from public.gig_posts where id=p_gig_id for update;
  if not found or gig.poster_character_id <> cid then raise exception 'GIG_NOT_FOUND'; end if;
  if gig.status <> 'open' or gig.expires_at <= now() then raise exception 'GIG_UNAVAILABLE'; end if;
  if not exists(select 1 from public.gig_applications where gig_id=gig.id and applicant_character_id=p_applicant_character_id) then
    raise exception 'APPLICANT_NOT_FOUND';
  end if;
  update public.gig_posts set status='accepted', accepted_worker_id=p_applicant_character_id, accepted_at=now()
    where id=gig.id returning * into gig;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status,'workerId',gig.accepted_worker_id);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_accept',receipt);
  return receipt;
end $$;

-- The poster confirms the job is done. The poster pays the worker from their own wallet.
-- If the poster cannot cover the pay, the job is cancelled and nothing is charged.
create or replace function public.gig_confirm_complete(p_user_id uuid, p_request_id uuid, p_gig_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype;
begin
  cid := public._gig_character(p_user_id);
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into receipt from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='gig_confirm';
  if found then return receipt; end if;
  select * into gig from public.gig_posts where id=p_gig_id for update;
  if not found or gig.poster_character_id <> cid then raise exception 'GIG_NOT_FOUND'; end if;
  if gig.status <> 'accepted' or gig.expires_at <= now() then raise exception 'GIG_UNAVAILABLE'; end if;
  begin
    perform public._gig_move_money(gig.poster_character_id, p_user_id, gig.pay_minor, 'debit', 'Gig pay: '||gig.title, gig.id);
    perform public._gig_move_money(gig.accepted_worker_id, (select user_id from public.characters where id=gig.accepted_worker_id),
      gig.pay_minor, 'credit', 'Gig pay: '||gig.title, gig.id);
    update public.gig_posts set status='completed', completed_at=now() where id=gig.id returning * into gig;
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_FUNDS' then raise; end if;
    update public.gig_posts set status='cancelled' where id=gig.id returning * into gig;
  end;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status,'pay',gig.pay_minor);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_confirm',receipt);
  return receipt;
end $$;

-- The poster cancels a job before it is completed. Nothing has been charged, so nothing is refunded.
create or replace function public.gig_cancel(p_user_id uuid, p_request_id uuid, p_gig_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype;
begin
  cid := public._gig_character(p_user_id);
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into receipt from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='gig_cancel';
  if found then return receipt; end if;
  select * into gig from public.gig_posts where id=p_gig_id for update;
  if not found or gig.poster_character_id <> cid then raise exception 'GIG_NOT_FOUND'; end if;
  if gig.status not in ('open','accepted') then raise exception 'GIG_UNAVAILABLE'; end if;
  update public.gig_posts set status='cancelled' where id=gig.id returning * into gig;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_cancel',receipt);
  return receipt;
end $$;

-- Expires any job not completed within 24 hours, whether open or accepted.
create or replace function public.gig_expire_due()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer := 0;
begin
  update public.gig_posts set status='expired'
    where status in ('open','accepted') and expires_at <= now();
  get diagnostics changed = row_count;
  return changed;
end $$;

revoke all on function public._gig_character(uuid) from public, anon, authenticated;
revoke all on function public._gig_move_money(uuid, uuid, bigint, text, text, uuid) from public, anon, authenticated;
revoke all on function public.gig_expire_due() from public, anon, authenticated;
grant execute on function public.gig_post(uuid, uuid, text, text, bigint) to service_role;
grant execute on function public.gig_apply(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.gig_accept(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.gig_confirm_complete(uuid, uuid, uuid) to service_role;
grant execute on function public.gig_cancel(uuid, uuid, uuid) to service_role;
grant execute on function public.gig_expire_due() to service_role;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute $job$ select cron.schedule('gig-work-expiry-5min','*/5 * * * *','select public.gig_expire_due();') $job$;
  end if;
exception when undefined_function or insufficient_privilege then null;
end $$;
