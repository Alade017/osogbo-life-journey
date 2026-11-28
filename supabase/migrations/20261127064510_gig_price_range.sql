-- Gig pay becomes a range. pay_minor is the minimum, pay_max_minor the maximum; a fixed price has both equal.
-- An applicant's offer must sit inside the range. Picking an applicant records the agreed amount
-- (their offer, or the minimum when they gave none), and confirming pays that agreed amount.
alter table public.gig_posts add column if not exists pay_max_minor bigint;
alter table public.gig_posts add column if not exists agreed_pay_minor bigint;
update public.gig_posts set pay_max_minor = pay_minor where pay_max_minor is null;
alter table public.gig_posts alter column pay_max_minor set not null;
alter table public.gig_posts drop constraint if exists gig_posts_pay_range;
alter table public.gig_posts add constraint gig_posts_pay_range
  check (pay_minor >= 1 and pay_max_minor >= pay_minor);

drop function if exists public.gig_post(uuid, uuid, text, text, bigint);

create or replace function public.gig_post(p_user_id uuid, p_request_id uuid, p_title text, p_description text, p_pay_minor bigint, p_pay_max_minor bigint default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if p_pay_max_minor is not null and p_pay_max_minor < p_pay_minor then raise exception 'INVALID_REQUEST'; end if;
  insert into public.gig_posts(poster_character_id,title,description,pay_minor,pay_max_minor)
    values(cid,trim(p_title),trim(p_description),p_pay_minor,coalesce(p_pay_max_minor,p_pay_minor)) returning * into gig;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status,'expiresAt',gig.expires_at);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_post',receipt);
  return receipt;
end $function$;

create or replace function public.gig_apply(p_user_id uuid, p_request_id uuid, p_gig_id uuid, p_offer_minor bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if p_offer_minor is not null and (p_offer_minor < gig.pay_minor or p_offer_minor > gig.pay_max_minor) then
    raise exception 'OFFER_OUT_OF_RANGE';
  end if;
  insert into public.gig_applications(gig_id,applicant_character_id,offer_minor)
    values(gig.id,cid,p_offer_minor)
    on conflict (gig_id, applicant_character_id) do update set offer_minor = excluded.offer_minor;
  receipt := jsonb_build_object('gigId',gig.id,'applied',true);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_apply',receipt);
  return receipt;
end $function$;

create or replace function public.gig_accept(p_user_id uuid, p_request_id uuid, p_gig_id uuid, p_applicant_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype; applicant_offer bigint;
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
  select a.offer_minor into applicant_offer from public.gig_applications a
    where a.gig_id=gig.id and a.applicant_character_id=p_applicant_character_id;
  if not found then raise exception 'APPLICANT_NOT_FOUND'; end if;
  update public.gig_posts
    set status='accepted', accepted_worker_id=p_applicant_character_id, accepted_at=now(),
        agreed_pay_minor=coalesce(applicant_offer, gig.pay_minor)
    where id=gig.id returning * into gig;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status,'workerId',gig.accepted_worker_id,'pay',gig.agreed_pay_minor);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_accept',receipt);
  return receipt;
end $function$;

create or replace function public.gig_confirm_complete(p_user_id uuid, p_request_id uuid, p_gig_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cid uuid; receipt jsonb; gig public.gig_posts%rowtype; amount bigint;
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
  amount := coalesce(gig.agreed_pay_minor, gig.pay_minor);
  begin
    perform public._gig_move_money(gig.poster_character_id, p_user_id, amount, 'debit', 'Gig pay: '||gig.title, gig.id);
    perform public._gig_move_money(gig.accepted_worker_id, (select user_id from public.characters where id=gig.accepted_worker_id),
      amount, 'credit', 'Gig pay: '||gig.title, gig.id);
    update public.gig_posts set status='completed', completed_at=now() where id=gig.id returning * into gig;
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_FUNDS' then raise; end if;
    update public.gig_posts set status='cancelled' where id=gig.id returning * into gig;
  end;
  receipt := jsonb_build_object('gigId',gig.id,'status',gig.status,'pay',amount);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'gig_confirm',receipt);
  return receipt;
end $function$;

create or replace function public.gig_board(p_user_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare cid uuid := public._gig_character(p_user_id);
begin
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform public.gig_expire_due();
  return jsonb_build_object(
    'open', coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'description',g.description,
        'pay',g.pay_minor,'payMax',g.pay_max_minor,'expiresAt',g.expires_at,'posterName',pc.name,
        'applied', exists(select 1 from public.gig_applications a where a.gig_id=g.id and a.applicant_character_id=cid))
        order by g.created_at desc)
      from public.gig_posts g join public.characters pc on pc.id=g.poster_character_id
      where g.status='open' and g.expires_at>now() and g.poster_character_id<>cid
    ),'[]'::jsonb),
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'description',g.description,
        'pay',g.pay_minor,'payMax',g.pay_max_minor,'agreedPay',g.agreed_pay_minor,'status',g.status,'expiresAt',g.expires_at,
        'workerId',g.accepted_worker_id,'workerName',wc.name,
        'applicants', coalesce((
          select jsonb_agg(jsonb_build_object('characterId',a.applicant_character_id,'name',ac.name,
            'offer',a.offer_minor) order by a.created_at)
          from public.gig_applications a join public.characters ac on ac.id=a.applicant_character_id
          where a.gig_id=g.id),'[]'::jsonb))
        order by g.created_at desc)
      from public.gig_posts g left join public.characters wc on wc.id=g.accepted_worker_id
      where g.poster_character_id=cid
    ),'[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'pay',coalesce(g.agreed_pay_minor,g.pay_minor),
        'status',g.status,'expiresAt',g.expires_at,'posterName',pc.name,'posterId',g.poster_character_id)
        order by g.created_at desc)
      from public.gig_posts g join public.characters pc on pc.id=g.poster_character_id
      where g.accepted_worker_id=cid
    ),'[]'::jsonb)
  );
end $function$;

notify pgrst, 'reload schema';
