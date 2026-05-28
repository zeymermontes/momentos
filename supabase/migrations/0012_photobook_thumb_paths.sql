-- Add thumbnail path columns for preview images.
alter table photobook_projects add column cover_thumb_path text;
alter table photobook_pages add column thumb_path text;
