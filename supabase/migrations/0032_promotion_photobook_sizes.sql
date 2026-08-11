-- Let a `fotolibros`-scoped promotion target specific photobook sizes.
--
-- Sizes are not rows in a table — they live in the `photobook` JSON blob in
-- `site_settings` and are identified by their `cm` value. So instead of a
-- link table (the pattern used for products/categories) we store the chosen
-- sizes inline as an int array.
--
-- NULL or empty array = every size qualifies, which is exactly the behaviour
-- every existing `fotolibros` rule already has. No backfill needed.
alter table promotion_rules
  add column if not exists photobook_size_cm int[];

comment on column promotion_rules.photobook_size_cm is
  'For scope = fotolibros: the photobook sizes (in cm) that qualify. NULL/empty = all sizes.';
