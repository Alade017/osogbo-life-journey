-- Nigerian schools news for the Nigerian Schools phone app. Same cache as the other news feeds.
alter table public.external_news_items drop constraint if exists external_news_items_region_check;
alter table public.external_news_items
  add constraint external_news_items_region_check check (region in ('nigeria','world','osun','schools'));

alter table public.external_news_refreshes drop constraint if exists external_news_refreshes_region_check;
alter table public.external_news_refreshes
  add constraint external_news_refreshes_region_check check (region in ('nigeria','world','osun','schools'));
