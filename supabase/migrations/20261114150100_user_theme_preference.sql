alter table public.profiles
  add column theme_preference text not null default 'system'
  check (theme_preference in ('system', 'light', 'dark'));

grant update (theme_preference) on public.profiles to authenticated;
