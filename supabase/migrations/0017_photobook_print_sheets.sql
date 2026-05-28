-- Store generated print sheet storage paths on the photobook project
-- so admins don't have to regenerate every time they open the detail page.
alter table photobook_projects add column print_sheets jsonb;
