update public.jobs
set name = 'Osun Mall Sales Assistant'
where slug = 'osun_mall_sales_assistant';

update public.jobs
set name = 'Osun Mall Stock Associate'
where slug = 'osun_mall_stock_associate';

notify pgrst, 'reload schema';
