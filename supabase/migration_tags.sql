-- ==============================================================================
-- MIGRATION: Sistema de Tags para Casos de Teste
-- Execute no SQL Editor do Supabase após o setup_completo.sql
-- ==============================================================================

-- 1. Tabela de tags
create table if not exists public.tags (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    color      text not null default '#1677ff',
    created_at timestamptz not null default now(),
    constraint tags_name_unique unique (name)
);

-- 2. Relacionamento N:N entre test_cases e tags
create table if not exists public.test_case_tags (
    test_case_id uuid not null references public.test_cases(id) on delete cascade,
    tag_id       uuid not null references public.tags(id)       on delete cascade,
    primary key (test_case_id, tag_id)
);

-- 3. Índices
create index if not exists idx_test_case_tags_case on public.test_case_tags(test_case_id);
create index if not exists idx_test_case_tags_tag  on public.test_case_tags(tag_id);

-- 4. Habilitar RLS
alter table public.tags           enable row level security;
alter table public.test_case_tags enable row level security;

-- 5. Policies para tags
--    SELECT: todos os autenticados
--    INSERT/UPDATE: todos autenticados (qa e admin)
--    DELETE: apenas admin
create policy "tags_select" on public.tags
    for select to authenticated using (true);

create policy "tags_insert" on public.tags
    for insert to authenticated
    with check (true);

create policy "tags_update" on public.tags
    for update to authenticated
    using  (public.get_current_user_role() != 'viewer'::user_role)
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "tags_delete" on public.tags
    for delete to authenticated
    using (public.get_current_user_role() = 'admin'::user_role);

-- 6. Policies para test_case_tags
create policy "test_case_tags_select" on public.test_case_tags
    for select to authenticated using (true);

create policy "test_case_tags_insert" on public.test_case_tags
    for insert to authenticated
    with check (true);

create policy "test_case_tags_delete" on public.test_case_tags
    for delete to authenticated
    using (true);

-- 7. Seed: criar tag Smoke padrão
insert into public.tags (name, color) values ('Smoke', '#fa8c16')
on conflict (name) do nothing;

-- Verificação
select id, name, color from public.tags;
