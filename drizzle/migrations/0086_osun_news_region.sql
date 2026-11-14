-- Osun State headlines for the Osun Gist phone app. Same cache as the Nigeria and World feeds.
alter table public.external_news_items drop constraint if exists external_news_items_region_check;
alter table public.external_news_items
  add constraint external_news_items_region_check check (region in ('nigeria','world','osun'));

alter table public.external_news_refreshes drop constraint if exists external_news_refreshes_region_check;
alter table public.external_news_refreshes
  add constraint external_news_refreshes_region_check check (region in ('nigeria','world','osun'));
