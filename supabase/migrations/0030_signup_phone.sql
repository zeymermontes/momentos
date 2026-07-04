-- El registro ahora pide teléfono obligatorio (WhatsApp). El signup lo
-- manda en raw_user_meta_data.phone; el trigger lo copia a profiles.phone
-- para que quede disponible sin tocar auth.users.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;
