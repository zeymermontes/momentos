-- Let a `fotolibros`-scoped promotion also target specific page counts.
--
-- Price is a function of (size, page_count) — a 16×16 runs $300 at 60 pages
-- and $400 at 100 — so targeting size alone was too coarse: a promo meant for
-- the cheap end also discounted the expensive one.
--
-- Same shape as photobook_size_cm (0032): the page counts live in the
-- `photobook` JSON blob in `site_settings`, not in a table, so they ride
-- inline as an int array. NULL or empty = every page count qualifies, which
-- is what every existing rule already does. No backfill needed.
--
-- Sizes and page counts combine with AND: picking 16×16 plus 60 pages matches
-- only the 16×16/60 combination, not every 16×16 and not every 60-page book.
alter table promotion_rules
  add column if not exists photobook_page_count int[];

comment on column promotion_rules.photobook_page_count is
  'For scope = fotolibros: the page counts that qualify. NULL/empty = all. ANDed with photobook_size_cm.';
