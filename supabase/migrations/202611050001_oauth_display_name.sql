-- OAuth-Anbieter (z. B. Apple) liefern oft nur eine anonyme Relay-Mail; der Name aus den
-- Metadaten ist als Anzeigename-Vorschlag besser.
create or replace function public.sync_community_member_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.community_members as current_member (
    user_id,
    email,
    display_name,
    status,
    email_confirmed_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 60), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 60), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'name'), 60), ''),
      case
        when new.email like '%@privaterelay.appleid.com' then null
        else nullif(left(split_part(coalesce(new.email, ''), '@', 1), 60), '')
      end,
      'Community-Mitglied'
    ),
    case
      when new.raw_app_meta_data ->> 'role' = 'admin' then 'approved'
      else 'pending'
    end,
    new.email_confirmed_at
  )
  on conflict (user_id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      status = case
        when new.raw_app_meta_data ->> 'role' = 'admin' then 'approved'
        else current_member.status
      end;
  return new;
end;
$$;

revoke all on function public.sync_community_member_from_auth() from public;
