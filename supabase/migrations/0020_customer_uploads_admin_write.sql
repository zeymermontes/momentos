-- Allow admins to INSERT and UPDATE in customer-uploads regardless of the
-- folder. Needed so that an admin (other than the project owner) can
-- generate / regenerate photobook print sheets for a customer's project.
--
-- Previous policies (0003, 0011) only let users write inside their own
-- {auth.uid()}/... folder. Admins could already read and delete; this
-- migration extends INSERT and UPDATE with the same is_admin() override.

drop policy if exists "customer_uploads_owner_write" on storage.objects;
create policy "customer_uploads_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'customer-uploads'
    and (
      is_admin()
      or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

drop policy if exists "customer_uploads_owner_update" on storage.objects;
create policy "customer_uploads_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'customer-uploads'
    and (
      is_admin()
      or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
    )
  )
  with check (
    bucket_id = 'customer-uploads'
    and (
      is_admin()
      or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );
