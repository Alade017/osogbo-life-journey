-- Internal money, character and table helpers are called only from other SECURITY DEFINER functions, which
-- run as the owner. Anonymous and signed-in players could call them directly with any character or user id:
-- _mini_game_credit would credit any wallet. Remove their execute rights. The stake-Ludo RPCs are unused by the
-- app and let a seated player choose the winning seat, so they are locked until they are rebuilt in the repo.
-- RLS helpers (_my_character_id, _my_social_character_id, _social_blocked) are left as they are.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      '_mini_game_credit', '_mini_game_debit', '_mini_game_settle', '_mini_game_assert_free',
      '_advance_character_game_time', '_apply_career_pay_bonus', '_award_career_skill', '_course_completed',
      '_initialize_property_rent', '_job_requirement_errors', '_notify', '_perform_job_once',
      '_player_course_recalc_missions', '_refresh_energy', '_set_character_start_location',
      '_settle_player_company_earnings', '_validate_job_shift_requirements', '_home_furniture_within_owned',
      'complete_education_course_for_user')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'mini_game_ludo_commit', 'mini_game_ludo_init', 'mini_game_ludo_load', 'mini_game_ludo_view', 'mini_game_create_ludo_table')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
