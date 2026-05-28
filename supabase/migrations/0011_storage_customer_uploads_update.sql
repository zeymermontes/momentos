-- Add missing UPDATE policy for customer-uploads storage bucket.
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
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
