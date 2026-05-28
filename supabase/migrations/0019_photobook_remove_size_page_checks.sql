-- Photobook sizes and page counts are now configurable from the admin
-- (site_settings.photobook), so the hardcoded CHECK constraints from
-- 0010 no longer apply. Drop them and rely on app-side validation
-- against the live settings.

alter table public.photobook_projects
  drop constraint if exists photobook_projects_size_cm_check;

alter table public.photobook_projects
  drop constraint if exists photobook_projects_page_count_check;
