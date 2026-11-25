-- TreasureVault metadata schema. Original media remains in Google Drive.
create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_file_id text,
  drive_name text not null,
  display_name text,
  description text,
  asset_type text not null check (asset_type in ('project','transition','footage','broll','sfx','music','image','font','archive','other')),
  mime_type text,
  file_extension text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  frame_rate numeric(8,3),
  tags text[] not null default '{}',
  mood text[] not null default '{}',
  dominant_colors text[] not null default '{}',
  thumbnail_url text,
  drive_web_view_link text,
  source_url text,
  source_provider text,
  license_name text,
  metadata jsonb not null default '{}'::jsonb,
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(display_name, drive_name)), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'A') ||
    setweight(to_tsvector('english', array_to_string(mood, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(file_extension, '') || ' ' || asset_type), 'C')
  ) stored,
  embedding vector(1536),
  is_favorite boolean not null default false,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, drive_file_id)
);

create index if not exists assets_user_created_idx on public.assets(user_id, created_at desc);
create index if not exists assets_user_type_idx on public.assets(user_id, asset_type);
create index if not exists assets_search_idx on public.assets using gin(search_document);
create index if not exists assets_tags_idx on public.assets using gin(tags);
create index if not exists assets_embedding_idx on public.assets using hnsw(embedding vector_cosine_ops);
drop trigger if exists assets_updated_at on public.assets;
create trigger assets_updated_at before update on public.assets for each row execute function public.set_updated_at();

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
create index if not exists collections_user_idx on public.collections(user_id, created_at desc);
drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at before update on public.collections for each row execute function public.set_updated_at();

create table if not exists public.collection_assets (
  collection_id uuid not null references public.collections(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(collection_id, asset_id)
);

alter table public.assets enable row level security;
alter table public.collections enable row level security;
alter table public.collection_assets enable row level security;

drop policy if exists "Users manage own assets" on public.assets;
create policy "Users manage own assets" on public.assets for all
using(auth.uid() = user_id) with check(auth.uid() = user_id);
drop policy if exists "Users manage own collections" on public.collections;
create policy "Users manage own collections" on public.collections for all
using(auth.uid() = user_id) with check(auth.uid() = user_id);
drop policy if exists "Users manage own collection links" on public.collection_assets;
create policy "Users manage own collection links" on public.collection_assets for all
using (
  exists(select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  and exists(select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid())
)
with check (
  exists(select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  and exists(select 1 from public.assets a where a.id = asset_id and a.user_id = auth.uid())
);

create or replace function public.search_assets(search_text text, filter_type text default null, result_limit integer default 40)
returns setof public.assets language sql stable security invoker set search_path = public as $$
  select a.* from public.assets a
  where a.user_id = auth.uid()
    and (filter_type is null or a.asset_type = filter_type)
    and (nullif(trim(search_text), '') is null
      or a.search_document @@ websearch_to_tsquery('english', search_text)
      or coalesce(a.display_name, a.drive_name) ilike '%' || search_text || '%')
  order by case when nullif(trim(search_text), '') is null then 0
    else ts_rank(a.search_document, websearch_to_tsquery('english', search_text)) end desc,
    a.created_at desc
  limit greatest(1, least(result_limit, 100));
$$;
grant execute on function public.search_assets(text, text, integer) to authenticated;
