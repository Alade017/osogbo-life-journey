-- Explicitly close the anon role's direct execute grant on the presence RPC (Supabase default privileges).
revoke all on function public.set_osun_mall_presence(text) from anon;

notify pgrst, 'reload schema';
