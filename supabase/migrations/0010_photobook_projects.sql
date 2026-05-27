-- Photo book projects and pages.

create table photobook_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  size_cm int not null check (size_cm in (15, 20, 30)),
  page_count int not null check (page_count in (20, 40, 60)),
  title text not null default '',
  cover_image_path text,
  cover_crop jsonb default '{"x":0,"y":0,"scale":1}',
  status text not null default 'draft' check (status in ('draft','completed','ordered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table photobook_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references photobook_projects(id) on delete cascade,
  sort_order int not null,
  image_path text,
  crop jsonb default '{"x":0,"y":0,"scale":1}',
  created_at timestamptz not null default now(),
  unique (project_id, sort_order)
);

create index idx_photobook_pages_project on photobook_pages(project_id, sort_order);

-- RLS
alter table photobook_projects enable row level security;
alter table photobook_pages enable row level security;

create policy "photobook_projects_owner_select"
  on photobook_projects for select
  using (auth.uid() = user_id or is_admin());

create policy "photobook_projects_owner_insert"
  on photobook_projects for insert
  with check (auth.uid() = user_id);

create policy "photobook_projects_owner_update"
  on photobook_projects for update
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

create policy "photobook_projects_owner_delete"
  on photobook_projects for delete
  using (auth.uid() = user_id or is_admin());

create policy "photobook_pages_owner_select"
  on photobook_pages for select
  using (
    exists (
      select 1 from photobook_projects p
      where p.id = project_id and (p.user_id = auth.uid() or is_admin())
    )
  );

create policy "photobook_pages_owner_insert"
  on photobook_pages for insert
  with check (
    exists (
      select 1 from photobook_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "photobook_pages_owner_update"
  on photobook_pages for update
  using (
    exists (
      select 1 from photobook_projects p
      where p.id = project_id and (p.user_id = auth.uid() or is_admin())
    )
  );

create policy "photobook_pages_owner_delete"
  on photobook_pages for delete
  using (
    exists (
      select 1 from photobook_projects p
      where p.id = project_id and (p.user_id = auth.uid() or is_admin())
    )
  );
