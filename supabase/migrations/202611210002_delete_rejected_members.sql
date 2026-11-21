create function public.delete_rejected_community_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible boolean;
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'Nur Administratoren dürfen Mitglieder löschen'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.community_members
    where user_id = p_user_id
      and (
        status = 'rejected'
        or (status = 'pending' and email_confirmed_at is null)
      )
  ) into eligible;

  if not eligible then
    raise exception 'Mitglied ist nicht zum Löschen freigegeben';
  end if;

  delete from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Mitgliedskonto wurde nicht gefunden';
  end if;
end;
$$;

revoke all on function public.delete_rejected_community_member(uuid) from public;
revoke all on function public.delete_rejected_community_member(uuid) from anon;
grant execute on function public.delete_rejected_community_member(uuid) to authenticated;
