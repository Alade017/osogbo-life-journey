-- Read model for the Gig Work app: open jobs, my posts with applicants, and jobs I was picked for.
create or replace function public.gig_board(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare cid uuid := public._gig_character(p_user_id);
begin
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  return jsonb_build_object(
    'open', coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'description',g.description,
        'pay',g.pay_minor,'expiresAt',g.expires_at,'posterName',pc.name,
        'applied', exists(select 1 from public.gig_applications a where a.gig_id=g.id and a.applicant_character_id=cid))
        order by g.created_at desc)
      from public.gig_posts g join public.characters pc on pc.id=g.poster_character_id
      where g.status='open' and g.expires_at>now() and g.poster_character_id<>cid
    ),'[]'::jsonb),
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'description',g.description,
        'pay',g.pay_minor,'status',g.status,'expiresAt',g.expires_at,
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
      select jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'pay',g.pay_minor,
        'status',g.status,'expiresAt',g.expires_at,'posterName',pc.name,'posterId',g.poster_character_id)
        order by g.created_at desc)
      from public.gig_posts g join public.characters pc on pc.id=g.poster_character_id
      where g.accepted_worker_id=cid
    ),'[]'::jsonb)
  );
end $$;

revoke all on function public.gig_board(uuid) from public, anon, authenticated;
grant execute on function public.gig_board(uuid) to service_role;
