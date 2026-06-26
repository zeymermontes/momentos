-- Fix: customer checkout was failing with
--   "new row violates row-level security policy for table order_items"
--
-- The original 0002_rls_policies.sql granted order_items SELECT to the
-- order owner and ALL operations to admins — but no INSERT policy for the
-- owner. The checkout server action inserts the line items with the user's
-- session client right after creating the order, so the insert was being
-- rejected by RLS even though the orders insert (which has
-- orders_owner_insert) succeeded.
--
-- This adds an INSERT policy that lets a user write items into orders
-- they own. UPDATE/DELETE stay admin-only — once an order is created,
-- customers shouldn't be able to mutate its line items directly.

create policy "order_items_owner_insert" on order_items for insert
  with check (
    exists (
      select 1 from orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  );
