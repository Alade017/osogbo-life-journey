-- The request-ID wrapper manage_my_stall_stock_request is live, and the deployed client
-- calls it. Remove browser access to the four-argument overload, which can move stock
-- without a request ID. The wrapper still calls it as the function owner, so stock
-- changes keep working.
revoke all on function public.manage_my_stall_stock(text,uuid,integer,bigint) from public, anon, authenticated;
