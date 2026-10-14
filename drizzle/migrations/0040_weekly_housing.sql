-- Weekly rent data is additive: existing ids, saved homes and monthly fields remain intact.
alter table public.jobs
  add column if not exists income_band text not null default 'low';
alter table public.jobs drop constraint if exists jobs_income_band_valid;
alter table public.jobs add constraint jobs_income_band_valid
  check (income_band in ('low','medium','high'));
update public.jobs
set income_band = case when salary >= 10000 then 'high' when salary >= 5000 then 'medium' else 'low' end;

alter table public.house_types
  add column if not exists description text not null default '',
  add column if not exists floors smallint not null default 1 check (floors between 1 and 5),
  add column if not exists shared_facilities boolean not null default false,
  add column if not exists weekly_rent_minor bigint not null default 0 check (weekly_rent_minor >= 0),
  add column if not exists min_weekly_income_minor bigint not null default 0 check (min_weekly_income_minor >= 0),
  add column if not exists preference_tags text[] not null default '{}',
  add column if not exists deposit_weeks smallint not null default 2 check (deposit_weeks between 0 and 52),
  add column if not exists verify boolean not null default true,
  add column if not exists placeholder boolean not null default true,
  add column if not exists extra_requirements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extra_requirements) = 'array');

update public.house_types set
  description = 'A low-cost room in a shared home with common facilities.',
  floors = 1, shared_facilities = true, weekly_rent_minor = 2000,
  min_weekly_income_minor = 0, preference_tags = array['starter','shared','budget'],
  deposit_weeks = 2, verify = true, placeholder = true, extra_requirements = '[]'::jsonb
where id = 'shared-room';
update public.house_types set
  description = 'A private bedroom with shared household facilities.',
  floors = 1, shared_facilities = true, weekly_rent_minor = 4000,
  min_weekly_income_minor = 8000, preference_tags = array['starter','private-room','budget'],
  deposit_weeks = 2, verify = true, placeholder = true, extra_requirements = '[]'::jsonb
where id = 'single-room';
update public.house_types set
  description = 'A compact private flat with its own kitchen and bathroom.',
  floors = 1, shared_facilities = false, weekly_rent_minor = 7000,
  min_weekly_income_minor = 14000, preference_tags = array['starter','private','independent','comfortable','close-to-work'],
  deposit_weeks = 2, verify = true, placeholder = true, extra_requirements = '[]'::jsonb
where id = 'studio-flat';

insert into public.house_types
  (id,label,bedrooms,kitchen_access,bathroom_access,monthly_rent,deposit,asset_key,slots,sort_order,
   description,floors,shared_facilities,weekly_rent_minor,min_weekly_income_minor,preference_tags,
   deposit_weeks,verify,placeholder,extra_requirements)
select seed.id,seed.label,seed.bedrooms,seed.kitchen_access,seed.bathroom_access,
  seed.weekly_rent_minor * 4,seed.weekly_rent_minor * seed.deposit_weeks,seed.asset_key,
  base.slots,seed.sort_order,seed.description,seed.floors,seed.shared_facilities,
  seed.weekly_rent_minor,seed.min_weekly_income_minor,seed.preference_tags,seed.deposit_weeks,
  true,true,seed.extra_requirements
from (values
  ('mini-flat','Mini flat',1,'private','private',12000::bigint,24000::bigint,
   'mini-flat',4,'A small self-contained flat suited to a solo player or couple.',1,false,
   array['private','independent','couple','comfortable','close-to-work']::text[],2::smallint,'[]'::jsonb),
  ('bungalow','Bungalow',3,'private','private',22000::bigint,44000::bigint,
   'bungalow',5,'A single-storey family home with room for shared household life.',1,false,
   array['family','private','space','comfortable']::text[],3::smallint,'[]'::jsonb),
  ('duplex','Duplex',4,'private','private',35000::bigint,70000::bigint,
   'duplex',6,'A two-storey family home with separate spaces for work and rest.',2,false,
   array['family','private','space','premium','comfortable']::text[],3::smallint,
   '[{"any_of":[{"type":"job_income_band","value":"high"},{"type":"income_sources_at_least","value":2}]}]'::jsonb)
) as seed(id,label,bedrooms,kitchen_access,bathroom_access,weekly_rent_minor,
  min_weekly_income_minor,asset_key,sort_order,description,floors,shared_facilities,
  preference_tags,deposit_weeks,extra_requirements)
cross join lateral (select slots from public.house_types where id = 'studio-flat') base
on conflict (id) do update set
  label=excluded.label, bedrooms=excluded.bedrooms, kitchen_access=excluded.kitchen_access,
  bathroom_access=excluded.bathroom_access, monthly_rent=excluded.monthly_rent,
  deposit=excluded.deposit, asset_key=excluded.asset_key, sort_order=excluded.sort_order,
  description=excluded.description, floors=excluded.floors, shared_facilities=excluded.shared_facilities,
  weekly_rent_minor=excluded.weekly_rent_minor, min_weekly_income_minor=excluded.min_weekly_income_minor,
  preference_tags=excluded.preference_tags, deposit_weeks=excluded.deposit_weeks,
  verify=true, placeholder=true, extra_requirements=excluded.extra_requirements;

create or replace function public._housing_weekly_income(p_character_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  salary bigint;
  band text;
  sources integer := 0;
begin
  select j.salary,j.income_band into salary,band
  from public.character_jobs cj join public.jobs j on j.id=cj.job_id
  where cj.character_id=p_character_id and cj.is_current
  order by cj.updated_at desc limit 1;
  if salary is null then
    select j.salary,j.income_band into salary,band
    from public.characters c left join public.jobs j on j.slug=c.occupation_preference
    where c.id=p_character_id;
  end if;
  salary := coalesce(salary,0);
  if salary > 0 then sources := 1; end if;
  -- The current game economy has no persisted recurring-income source table yet.
  return jsonb_build_object(
    'weekly_job_income_minor',salary * 5,
    'weekly_recurring_income_minor',0,
    'weekly_income_minor',salary * 5,
    'monthly_income_minor',salary * 20,
    'job_income_band',coalesce(band,'low'),
    'income_source_count',sources
  );
end;
$$;
revoke all on function public._housing_weekly_income(uuid) from public,anon,authenticated;

create or replace function public.housing_eligible_houses(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  c public.characters%rowtype;
  w public.wallets%rowtype;
  income jsonb;
  houses jsonb;
begin
  select * into c from public.characters where user_id=p_user_id;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select * into w from public.wallets where character_id=c.id;
  income := public._housing_weekly_income(c.id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',h.id,'name',h.label,'label',h.label,'description',h.description,
    'bedrooms',h.bedrooms,'floors',h.floors,'shared_facilities',h.shared_facilities,
    'monthly_rent',h.monthly_rent,'deposit',h.deposit,
    'kitchen_access',h.kitchen_access,'bathroom_access',h.bathroom_access,
    'weekly_rent_minor',h.weekly_rent_minor,'min_weekly_income_minor',h.min_weekly_income_minor,
    'deposit_weeks',h.deposit_weeks,'deposit_minor',h.weekly_rent_minor*h.deposit_weeks,
    'upfront_total_minor',h.weekly_rent_minor*(h.deposit_weeks+1),
    'preference_tags',to_jsonb(h.preference_tags),'art_key',h.asset_key,
    'verify',h.verify,'placeholder',h.placeholder,'extra_requirements',h.extra_requirements,
    'eligible',(
      (income->>'weekly_income_minor')::bigint >= h.min_weekly_income_minor
      and coalesce(w.balance,0) >= h.weekly_rent_minor*(h.deposit_weeks+1)
      and not exists (
        select 1 from jsonb_array_elements(h.extra_requirements) requirement
        where not exists (
          select 1 from jsonb_array_elements(requirement->'any_of') alternative
          where (alternative->>'type'='job_income_band'
                 and alternative->>'value'=income->>'job_income_band')
             or (alternative->>'type'='income_sources_at_least'
                 and (income->>'income_source_count')::integer >= (alternative->>'value')::integer)
        )
      )
    ),
    'reason_code',case
      when (income->>'weekly_income_minor')::bigint < h.min_weekly_income_minor then 'INCOME_TOO_LOW'
      when exists (
        select 1 from jsonb_array_elements(h.extra_requirements) requirement
        where not exists (
          select 1 from jsonb_array_elements(requirement->'any_of') alternative
          where (alternative->>'type'='job_income_band'
                 and alternative->>'value'=income->>'job_income_band')
             or (alternative->>'type'='income_sources_at_least'
                 and (income->>'income_source_count')::integer >= (alternative->>'value')::integer)
        )
      ) then 'INCOME_TOO_LOW'
      when coalesce(w.balance,0) < h.weekly_rent_minor*(h.deposit_weeks+1) then 'INSUFFICIENT_FUNDS'
      else 'OK' end,
    'reason',case
      when (income->>'weekly_income_minor')::bigint < h.min_weekly_income_minor
        then 'Needs ₦'||to_char(h.min_weekly_income_minor,'FM999,999,999,990')||' weekly income'
      when exists (
        select 1 from jsonb_array_elements(h.extra_requirements) requirement
        where not exists (
          select 1 from jsonb_array_elements(requirement->'any_of') alternative
          where (alternative->>'type'='job_income_band'
                 and alternative->>'value'=income->>'job_income_band')
             or (alternative->>'type'='income_sources_at_least'
                 and (income->>'income_source_count')::integer >= (alternative->>'value')::integer)
        )
      ) then 'Needs a high-band job or at least two income sources'
      when coalesce(w.balance,0) < h.weekly_rent_minor*h.deposit_weeks
        then 'Deposit is ₦'||to_char(h.weekly_rent_minor*h.deposit_weeks-coalesce(w.balance,0),'FM999,999,999,990')||' short'
      when coalesce(w.balance,0) < h.weekly_rent_minor*(h.deposit_weeks+1)
        then 'First week’s rent is ₦'||to_char(h.weekly_rent_minor*(h.deposit_weeks+1)-coalesce(w.balance,0),'FM999,999,999,990')||' short'
      else null end,
    'slots',h.slots
  ) order by h.sort_order),'[]'::jsonb)
  into houses from public.house_types h where h.is_active;
  return jsonb_build_object(
    'monthly_income',income->'monthly_income_minor',
    'weekly_income_minor',income->'weekly_income_minor',
    'weekly_job_income_minor',income->'weekly_job_income_minor',
    'weekly_recurring_income_minor',income->'weekly_recurring_income_minor',
    'income_source_count',income->'income_source_count',
    'job_income_band',income->'job_income_band',
    'wallet_balance_minor',coalesce(w.balance,0),
    'first_payment_at',now(),
    'houses',houses
  );
end;
$$;
revoke all on function public.housing_eligible_houses(uuid) from public,anon,authenticated;
grant execute on function public.housing_eligible_houses(uuid) to service_role;

alter table public.player_homes
  add column if not exists next_rent_at timestamptz;

create or replace function public.housing_rent(p_user_id uuid,p_house_type_id text,p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  c public.characters%rowtype;
  w public.wallets%rowtype;
  h public.house_types%rowtype;
  rented_home public.player_homes%rowtype;
  prior public.housing_choice_idempotency%rowtype;
  listing jsonb;
  eligibility jsonb;
  request_hash text;
  paid_at timestamptz := now();
  response jsonb;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  request_hash := md5('weekly-rent:'||p_house_type_id);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_idempotency_key,0));
  select * into prior from public.housing_choice_idempotency
  where user_id=p_user_id and idempotency_key=p_idempotency_key for update;
  if found then
    if prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.response;
  end if;

  select * into c from public.characters where user_id=p_user_id for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select * into h from public.house_types where id=p_house_type_id and is_active for share;
  if not found then raise exception 'UNKNOWN_HOUSE'; end if;
  select * into w from public.wallets where character_id=c.id and user_id=p_user_id for update;
  if not found then raise exception 'NO_WALLET'; end if;

  eligibility := public.housing_eligible_houses(p_user_id);
  select item into listing
  from jsonb_array_elements(eligibility->'houses') item
  where item->>'id'=p_house_type_id;
  if coalesce((listing->>'eligible')::boolean,false)=false then
    raise exception '%',coalesce(listing->>'reason_code','HOUSE_INELIGIBLE');
  end if;

  update public.wallets set balance=balance-h.weekly_rent_minor*h.deposit_weeks,
    total_expenses=total_expenses+h.weekly_rent_minor*h.deposit_weeks,updated_at=paid_at
  where id=w.id returning * into w;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
    values(p_user_id,w.id,c.id,h.weekly_rent_minor*h.deposit_weeks,'expense','housing_deposit','Housing deposit: '||h.label);
  update public.wallets set balance=balance-h.weekly_rent_minor,
    total_expenses=total_expenses+h.weekly_rent_minor,updated_at=paid_at
  where id=w.id returning * into w;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
    values(p_user_id,w.id,c.id,h.weekly_rent_minor,'expense','housing_rent','First week rent: '||h.label);

  insert into public.player_homes(user_id,character_id,house_type_id,moved_in_at,next_rent_at)
  values(p_user_id,c.id,h.id,paid_at,paid_at+interval '7 days')
  on conflict(character_id) do update set house_type_id=excluded.house_type_id,
    moved_in_at=excluded.moved_in_at,next_rent_at=excluded.next_rent_at
  returning * into rented_home;

  update public.characters set onboarding_step='done',updated_at=paid_at where id=c.id;
  insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,x,y,placed)
    values(p_user_id,c.id,'starter-bed','bed','bed',24,66,true),
          (p_user_id,c.id,'starter-light','light','light',57,24,true),
          (p_user_id,c.id,'starter-seat','seat','seat',55,71,true)
  on conflict(character_id,item_id) do nothing;

  select jsonb_build_object(
    'home',jsonb_build_object('id',ph.id,'house_type_id',h.id,'moved_in_at',ph.moved_in_at,
      'next_rent_at',ph.next_rent_at,'house_types',jsonb_build_object(
        'id',h.id,'label',h.label,'bedrooms',h.bedrooms,'kitchen_access',h.kitchen_access,
        'bathroom_access',h.bathroom_access,'monthly_rent',h.monthly_rent,'deposit',h.deposit,
        'asset_key',h.asset_key,'slots',h.slots,'weekly_rent_minor',h.weekly_rent_minor)),
    'home_items',coalesce((select jsonb_agg(to_jsonb(i)) from public.home_items i where i.character_id=c.id),'[]'::jsonb),
    'wallet_balance',w.balance,'onboarding_step','done',
    'weekly_rent_minor',h.weekly_rent_minor,'deposit_minor',h.weekly_rent_minor*h.deposit_weeks,
    'first_payment_at',paid_at,'next_payment_at',paid_at+interval '7 days'
  ) into response from public.player_homes ph where ph.character_id=c.id;

  insert into public.housing_choice_idempotency(user_id,idempotency_key,request_hash,response)
  values(p_user_id,p_idempotency_key,request_hash,response);
  return response;
end;
$$;
revoke all on function public.housing_rent(uuid,text,text) from public,anon,authenticated;
grant execute on function public.housing_rent(uuid,text,text) to service_role;

create or replace function public.housing_defer(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update public.characters c set onboarding_step='done',updated_at=now()
  where c.user_id=p_user_id and c.onboarding_step='housing'
    and not exists(select 1 from public.player_homes h where h.character_id=c.id);
  if not found and not exists(select 1 from public.characters where user_id=p_user_id and onboarding_step='done') then
    raise exception 'HOUSING_NOT_PENDING';
  end if;
  return jsonb_build_object('onboarding_step','done','deferred',true,'home',null);
end;
$$;
revoke all on function public.housing_defer(uuid) from public,anon,authenticated;
grant execute on function public.housing_defer(uuid) to service_role;
