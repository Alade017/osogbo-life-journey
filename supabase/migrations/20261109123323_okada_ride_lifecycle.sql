-- Okada rides: a request is found a rider after 20 seconds, the ride completes 3 minutes later,
-- and a ride can be cancelled (fare refunded) only while it is still searching for a rider.
alter table public.okada_ride_requests add column if not exists assigned_at timestamptz;
alter table public.okada_ride_requests add column if not exists completed_at timestamptz;

-- Moves the caller's rides along. Safe to call often: it only changes rides that are due.
create or replace function public.okada_ride_sync() returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id();
begin
 if uid is null or cid is null then return; end if;
 update public.okada_ride_requests set status='assigned', assigned_at=now()
  where character_id=cid and user_id=uid and status='requested' and created_at<=now()-interval '20 seconds';
 update public.okada_ride_requests set status='completed', completed_at=now()
  where character_id=cid and user_id=uid and status='assigned' and assigned_at<=now()-interval '3 minutes';
end $$;

-- Cancels a ride that is still searching for a rider and refunds the fare. Returns the refunded amount.
create or replace function public.okada_ride_cancel(p_ride uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); ride public.okada_ride_requests%rowtype; wallet public.wallets%rowtype; cash_after bigint;
begin
 if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
 select * into ride from public.okada_ride_requests where id=p_ride and character_id=cid and user_id=uid for update;
 if not found then raise exception 'Ride not found'; end if;
 if ride.status<>'requested' or ride.created_at<=now()-interval '20 seconds' then
   raise exception 'This ride can no longer be cancelled';
 end if;
 select * into wallet from public.wallets where character_id=cid and user_id=uid for update;
 if not found then raise exception 'Wallet not found'; end if;
 cash_after:=wallet.balance+ride.fare_minor;
 update public.wallets set balance=cash_after,total_expenses=greatest(total_expenses-ride.fare_minor,0) where id=wallet.id;
 update public.okada_ride_requests set status='cancelled' where id=ride.id;
 insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,transaction_type,account,source,destination,balance_after,metadata)
  values(uid,wallet.id,cid,ride.fare_minor,'income','transport','Refund: okada ride to '||ride.destination,'refund','cash','Okada rides',ride.destination,cash_after,jsonb_build_object('ride_id',ride.id));
 return jsonb_build_object('refunded',ride.fare_minor,'cash',cash_after,'status','cancelled');
end $$;

revoke all on function public.okada_ride_sync(),public.okada_ride_cancel(uuid) from public,anon;
grant execute on function public.okada_ride_sync(),public.okada_ride_cancel(uuid) to authenticated;
notify pgrst,'reload schema';
