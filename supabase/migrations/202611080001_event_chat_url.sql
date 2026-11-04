alter table public.tours
  add column chat_url text,
  add constraint tours_chat_url_check
    check (
      chat_url is null
      or (
        collection_slug = 'events'
        and chat_url ~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com/channel)/[A-Za-z0-9_./?=&%-]+$'
      )
    );
