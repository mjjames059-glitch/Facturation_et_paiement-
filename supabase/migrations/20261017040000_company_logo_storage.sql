-- Les logos sont servis publiquement sur les factures partagées.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy company_logos_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

create policy company_logos_update_own on storage.objects
for update to authenticated using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
) with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);

create policy company_logos_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
);
