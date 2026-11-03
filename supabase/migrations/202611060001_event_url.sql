alter table public.tours
  add column event_url text,
  add constraint tours_event_url_check
    check (
      event_url is null
      or (
        collection_slug = 'events'
        and event_url ~* '^https?://'
      )
    );
