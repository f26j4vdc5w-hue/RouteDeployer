alter table public.collections
  add column if not exists color text not null default '#a45cff'
  check (color ~ '^#[0-9A-Fa-f]{6}$');

update public.collections
set color = '#ff4d57'
where slug = 'camp' and color = '#a45cff';
