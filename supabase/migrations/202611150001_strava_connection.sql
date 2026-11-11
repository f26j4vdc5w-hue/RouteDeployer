alter table public.community_members
  add column strava_athlete_id bigint,
  add column strava_access_token text,
  add column strava_refresh_token text,
  add column strava_token_expires_at timestamptz,
  add column strava_connected_at timestamptz,
  add column strava_refresh_lock uuid,
  add column strava_refresh_locked_at timestamptz;

-- Existing column-level grants exclude these columns, including for admins.
create function public.get_my_strava_connection()
returns table (connected_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select strava_connected_at from public.community_members
  where user_id = (select auth.uid()) and strava_connected_at is not null;
$$;

create function public.disconnect_my_strava()
returns void
language sql security definer set search_path = ''
as $$
  update public.community_members set
    strava_athlete_id = null, strava_access_token = null,
    strava_refresh_token = null, strava_token_expires_at = null,
    strava_connected_at = null, strava_refresh_lock = null,
    strava_refresh_locked_at = null
  where user_id = (select auth.uid());
$$;

create function public.save_strava_connection(
  p_user_id uuid, p_athlete_id bigint, p_access_token text,
  p_refresh_token text, p_expires_at timestamptz
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.community_members set
    strava_athlete_id = p_athlete_id, strava_access_token = p_access_token,
    strava_refresh_token = p_refresh_token, strava_token_expires_at = p_expires_at,
    strava_connected_at = now(), strava_refresh_lock = null, strava_refresh_locked_at = null
  where user_id = p_user_id;
  if not found then
    raise exception 'Community profile not found';
  end if;
end;
$$;

revoke all on function public.get_my_strava_connection() from public, anon;
grant execute on function public.get_my_strava_connection() to authenticated;
revoke all on function public.disconnect_my_strava() from public, anon;
grant execute on function public.disconnect_my_strava() to authenticated;
revoke all on function public.save_strava_connection(uuid, bigint, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.save_strava_connection(uuid, bigint, text, text, timestamptz) to service_role;
