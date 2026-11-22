-- Starting grant is 50,000 (matches the live function). This forward migration supersedes the
-- 5,000 grant in 202610170003_housing_onboarding.sql and 20261102215011_character_body_customization.sql,
-- which are already applied and are left unchanged. The function body below is the live definition.
CREATE OR REPLACE FUNCTION public.create_character(p_name text, p_gender text, p_appearance jsonb, p_age integer, p_personality text, p_occupation text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid:=auth.uid(); cid uuid; wid uuid; appr jsonb; k text;
  b_int int:=10; b_soc int:=10; b_car int:=10; b_hap int:=70;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists(select 1 from public.characters where user_id=uid) then raise exception 'You already have a character'; end if;
  p_name:=btrim(p_name);
  if p_name is null or char_length(p_name)<2 or char_length(p_name)>24 then raise exception 'Name must be 2-24 characters'; end if;
  if p_age is null or p_age not between 16 and 60 then raise exception 'Age must be between 16 and 60'; end if;
  if p_occupation is not null and not exists(select 1 from public.jobs where slug=p_occupation) then raise exception 'Unknown occupation'; end if;
  appr:='{}'::jsonb;
  foreach k in array array['skin','hair','hairColor','outfit','bottoms','shoes','headwear'] loop
    if p_appearance?k and jsonb_typeof(p_appearance->k)='number' and (p_appearance->>k)::int between 0 and 7 then appr:=appr||jsonb_build_object(k,(p_appearance->>k)::int); else appr:=appr||jsonb_build_object(k,0); end if;
  end loop;
  if jsonb_typeof(p_appearance->'stature')='number' then
    if (p_appearance->>'stature')::numeric between 0 and 2 and trunc((p_appearance->>'stature')::numeric)=(p_appearance->>'stature')::numeric then
      appr:=appr||jsonb_build_object('stature',(p_appearance->>'stature')::int);
    else
      appr:=appr||jsonb_build_object('stature',1);
    end if;
  else
    appr:=appr||jsonb_build_object('stature',1);
  end if;
  if jsonb_typeof(p_appearance->'build')='number' then
    if (p_appearance->>'build')::numeric between 0 and 3 and trunc((p_appearance->>'build')::numeric)=(p_appearance->>'build')::numeric then
      appr:=appr||jsonb_build_object('build',(p_appearance->>'build')::int);
    else
      appr:=appr||jsonb_build_object('build',1);
    end if;
  else
    appr:=appr||jsonb_build_object('build',1);
  end if;
  case p_personality
    when 'ambitious' then b_car:=15;
    when 'creative' then b_int:=13; b_hap:=72;
    when 'social' then b_soc:=15;
    when 'studious' then b_int:=15;
    when 'easygoing' then b_hap:=75;
    else raise exception 'Unknown personality';
  end case;
  insert into public.profiles(id,display_name) values(uid,p_name) on conflict(id) do nothing;
  insert into public.characters(user_id,name,gender,appearance,age,personality,occupation_preference,intelligence,social,career,happiness,onboarding_step)
    values(uid,p_name,p_gender,appr,p_age,p_personality,p_occupation,b_int,b_soc,b_car,b_hap,'housing') returning id into cid;
  insert into public.wallets(user_id,character_id) values(uid,cid) returning id into wid;
  perform public._credit(cid,50000,'starting_grant','Welcome to Osogbo starter funds');
  insert into public.player_inventory(user_id,character_id,item_id) select uid,cid,id from public.inventory_items where slug in ('phone','backpack','basic_outfit','water_bottle');
  insert into public.player_missions(user_id,character_id,mission_id) select uid,cid,id from public.missions on conflict(character_id,mission_id) do nothing;
  perform public._notify(cid,'Welcome to Osogbo, '||p_name||'!','Choose a place to live to begin your journey.','welcome');
  return cid;
end $function$;
