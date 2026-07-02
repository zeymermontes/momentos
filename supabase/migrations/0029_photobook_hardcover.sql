-- Track hardcover choice on the photobook project itself.
--
-- Previously the choice lived only inside the cart_item and order_item
-- `customization` JSONB, so /admin/fotolibros couldn't tell if a project
-- was pasta dura vs pasta blanda and its price column was under-reported
-- for hardcover books.
--
-- Column is nullable-less (`not null default false`) so all existing
-- rows get soft-cover as the initial value. Immediately after, backfill
-- any project that already made it into an order — reading the choice
-- out of order_items.customization so we don't lose the truth for
-- already-ordered projects.

alter table photobook_projects
  add column if not exists hardcover boolean not null default false;

-- Backfill: for each project that appears in an order_item, take the
-- hardcover value from the most recent order_item's customization JSON.
-- Cast the JSONB text to boolean via the standard "true"/"false" check.
update photobook_projects p
   set hardcover = coalesce((oi.customization->>'hardcover')::boolean, false)
  from order_items oi
 where (oi.customization->>'photobook_project_id') = p.id::text
   and (oi.customization->>'hardcover') is not null
   and oi.id = (
     select oi2.id
       from order_items oi2
      where (oi2.customization->>'photobook_project_id') = p.id::text
      order by oi2.id desc
      limit 1
   );
