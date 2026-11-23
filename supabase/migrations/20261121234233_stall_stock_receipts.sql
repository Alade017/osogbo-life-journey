-- Adds a request-ID wrapper. The old four-argument function stays callable until the client
-- that sends request IDs is deployed; revoke it in a follow-up migration after that.
create or replace function public.manage_my_stall_stock_request(
 p_action text,p_item_id uuid,p_quantity integer,p_price_minor bigint,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();cid uuid;cached record;payload jsonb;result jsonb;
begin
 if uid is null then raise exception 'REGISTERED_ACCOUNT_REQUIRED';end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED';end if;
 select id into cid from public.characters where user_id=uid for update;
 if cid is null then raise exception 'CHARACTER_REQUIRED';end if;
 payload:=jsonb_build_object('action',p_action,'item_id',p_item_id,'quantity',p_quantity,'price_minor',p_price_minor);
 select receipt.operation,receipt.result into cached from public.economy_request_results receipt
 where receipt.character_id=cid and receipt.request_id=p_request_id;
 if found then
  if cached.operation<>'market_stall_stock' or cached.result->'input' is distinct from payload then
   raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  return (cached.result->'result')||jsonb_build_object('duplicate',true);
 end if;
 -- Delegate to the existing atomic inventory-transfer implementation.
 execute 'select public.manage_my_stall_stock($1,$2,$3,$4)' into result
 using p_action,p_item_id,p_quantity,p_price_minor;
 insert into public.economy_request_results(character_id,request_id,operation,result)
 values(cid,p_request_id,'market_stall_stock',jsonb_build_object('input',payload,'result',result));
 return result||jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.manage_my_stall_stock_request(text,uuid,integer,bigint,uuid) from public,anon;
grant execute on function public.manage_my_stall_stock_request(text,uuid,integer,bigint,uuid) to authenticated;
notify pgrst,'reload schema';
