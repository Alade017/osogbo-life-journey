update public.game_properties set rent_price = 2000, updated_at = now()
where id = '57f8e6f2-2cc9-438f-b871-3f0cc1e58291';

update public.house_types set min_weekly_income_minor = 4000
where id = 'shared-room';

comment on column public.house_types.deposit_weeks is
  'Deposit in weeks of rent. Rule: 2 weeks for shared room through mini flat; 3 weeks for bungalow and duplex.';
