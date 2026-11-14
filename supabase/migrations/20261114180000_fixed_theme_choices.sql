alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

update public.profiles
set theme_preference = 'facturo'
where theme_preference = 'system';

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('facturo', 'light', 'dark', 'green', 'violet'));
