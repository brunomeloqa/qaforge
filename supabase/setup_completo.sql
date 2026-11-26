-- ==============================================================================
-- SETUP COMPLETO - QAFORGE (Execute este arquivo uma única vez no SQL Editor)
-- Inclui: Schema + RLS + Restrição de Domínio + Admin
-- Pode ser executado mesmo que algumas tabelas já existam (idempotente)
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════
-- PARTE 1: TIPOS ENUMERADOS
-- ══════════════════════════════════════════════════════════════

do $$ begin
    create type user_role as enum ('admin', 'qa', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type test_priority as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
    create type branch_status as enum ('testing', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
    create type run_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
    create type item_status as enum ('to_test', 'testing', 'failed', 'done');
exception when duplicate_object then null; end $$;


-- ══════════════════════════════════════════════════════════════
-- PARTE 2: TABELAS
-- ══════════════════════════════════════════════════════════════

create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    role user_role not null default 'qa',
    created_at timestamptz not null default now()
);

create table if not exists public.features (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    doc_url text,
    created_at timestamptz not null default now()
);

create table if not exists public.test_cases (
    id uuid primary key default gen_random_uuid(),
    feature_id uuid not null references public.features(id) on delete cascade,
    title text not null,
    priority test_priority not null default 'medium',
    created_at timestamptz not null default now()
);

create table if not exists public.qa_branches (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    review_date date not null default current_date,
    rejection_count int not null default 0,
    rejected_cards_count int not null default 0,
    bugs_created_count int not null default 0,
    status branch_status not null default 'testing',
    reason text,
    created_at timestamptz not null default now()
);

create table if not exists public.test_runs (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    status run_status not null default 'open',
    qa_branch_id uuid references public.qa_branches(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.test_run_items (
    id uuid primary key default gen_random_uuid(),
    test_run_id uuid not null references public.test_runs(id) on delete cascade,
    test_case_id uuid references public.test_cases(id) on delete set null,
    title_snapshot text not null,
    priority_snapshot text not null default 'medium',
    status item_status not null default 'to_test',
    comment text,
    qa_id uuid references public.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    action text not null,
    table_name text not null,
    record_id uuid,
    created_at timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════
-- PARTE 3: ÍNDICES
-- ══════════════════════════════════════════════════════════════

create index if not exists idx_test_cases_feature_id on public.test_cases(feature_id);
create index if not exists idx_test_runs_branch_id on public.test_runs(qa_branch_id);
create index if not exists idx_test_run_items_run_id on public.test_run_items(test_run_id);
create index if not exists idx_test_run_items_status on public.test_run_items(status);
create index if not exists idx_qa_branches_review_date on public.qa_branches(review_date);


-- ══════════════════════════════════════════════════════════════
-- PARTE 4: TRIGGER DE NOVO USUÁRIO
-- ══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger as $$
declare
    v_role user_role := 'qa';
begin
    if lower(new.email) not like '%@insanemedia.com.br' then
        raise exception 'Apenas e-mails @insanemedia.com.br são autorizados.';
    end if;

    if lower(new.email) = 'bruno.melo@insanemedia.com.br' then
        v_role := 'admin';
    end if;

    insert into public.users (id, email, role)
    values (new.id, new.email, v_role)
    on conflict (id) do update
    set
        email = excluded.email,
        role = case
            when lower(excluded.email) = 'bruno.melo@insanemedia.com.br' then 'admin'::user_role
            else public.users.role
        end;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- PARTE 5: HABILITAR RLS
-- ══════════════════════════════════════════════════════════════

alter table public.users enable row level security;
alter table public.features enable row level security;
alter table public.test_cases enable row level security;
alter table public.qa_branches enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_run_items enable row level security;
alter table public.audit_logs enable row level security;


-- ══════════════════════════════════════════════════════════════
-- PARTE 6: FUNÇÃO AUXILIAR DE ROLE
-- ══════════════════════════════════════════════════════════════

create or replace function public.get_current_user_role()
returns user_role as $$
declare
    v_role user_role;
begin
    select role into v_role from public.users where id = auth.uid();
    return coalesce(v_role, 'viewer'::user_role);
end;
$$ language plpgsql security definer;


-- ══════════════════════════════════════════════════════════════
-- PARTE 7: REMOVER POLICIES ANTIGAS
-- ══════════════════════════════════════════════════════════════

drop policy if exists "Usuários autenticados podem ver perfis" on public.users;
drop policy if exists "Usuários autenticados podem gerenciar features" on public.features;
drop policy if exists "Usuários autenticados podem gerenciar test_cases" on public.test_cases;
drop policy if exists "Usuários autenticados podem gerenciar qa_branches" on public.qa_branches;
drop policy if exists "Usuários autenticados podem gerenciar test_runs" on public.test_runs;
drop policy if exists "Usuários autenticados podem gerenciar test_run_items" on public.test_run_items;
drop policy if exists "Usuários autenticados podem ver e criar audit_logs" on public.audit_logs;
drop policy if exists "users_select_policy" on public.users;
drop policy if exists "users_admin_policy" on public.users;
drop policy if exists "features_select_policy" on public.features;
drop policy if exists "features_write_policy" on public.features;
drop policy if exists "test_cases_select_policy" on public.test_cases;
drop policy if exists "test_cases_write_policy" on public.test_cases;
drop policy if exists "qa_branches_select_policy" on public.qa_branches;
drop policy if exists "qa_branches_write_policy" on public.qa_branches;
drop policy if exists "test_runs_select_policy" on public.test_runs;
drop policy if exists "test_runs_write_policy" on public.test_runs;
drop policy if exists "test_run_items_select_policy" on public.test_run_items;
drop policy if exists "test_run_items_write_policy" on public.test_run_items;
drop policy if exists "audit_logs_select_policy" on public.audit_logs;
drop policy if exists "audit_logs_insert_policy" on public.audit_logs;


-- ══════════════════════════════════════════════════════════════
-- PARTE 8: POLICIES RLS POR ROLE
-- Estratégia: SELECT aberto a todos autenticados
--             INSERT/UPDATE/DELETE bloqueados para 'viewer'
-- ══════════════════════════════════════════════════════════════

-- USERS
create policy "users_select_policy" on public.users
    for select to authenticated using (true);

create policy "users_insert_policy" on public.users
    for insert to authenticated
    with check (public.get_current_user_role() = 'admin'::user_role);

create policy "users_update_policy" on public.users
    for update to authenticated
    using (public.get_current_user_role() = 'admin'::user_role)
    with check (public.get_current_user_role() = 'admin'::user_role);

create policy "users_delete_policy" on public.users
    for delete to authenticated
    using (public.get_current_user_role() = 'admin'::user_role);

-- FEATURES
create policy "features_select_policy" on public.features
    for select to authenticated using (true);

create policy "features_insert_policy" on public.features
    for insert to authenticated
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "features_update_policy" on public.features
    for update to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role)
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "features_delete_policy" on public.features
    for delete to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role);

-- TEST_CASES
create policy "test_cases_select_policy" on public.test_cases
    for select to authenticated using (true);

create policy "test_cases_insert_policy" on public.test_cases
    for insert to authenticated
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "test_cases_update_policy" on public.test_cases
    for update to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role)
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "test_cases_delete_policy" on public.test_cases
    for delete to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role);

-- QA_BRANCHES
create policy "qa_branches_select_policy" on public.qa_branches
    for select to authenticated using (true);

create policy "qa_branches_insert_policy" on public.qa_branches
    for insert to authenticated
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "qa_branches_update_policy" on public.qa_branches
    for update to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role)
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "qa_branches_delete_policy" on public.qa_branches
    for delete to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role);

-- TEST_RUNS
create policy "test_runs_select_policy" on public.test_runs
    for select to authenticated using (true);

create policy "test_runs_insert_policy" on public.test_runs
    for insert to authenticated
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "test_runs_update_policy" on public.test_runs
    for update to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role)
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "test_runs_delete_policy" on public.test_runs
    for delete to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role);

-- TEST_RUN_ITEMS
create policy "test_run_items_select_policy" on public.test_run_items
    for select to authenticated using (true);

create policy "test_run_items_insert_policy" on public.test_run_items
    for insert to authenticated
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "test_run_items_update_policy" on public.test_run_items
    for update to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role)
    with check (public.get_current_user_role() != 'viewer'::user_role);

create policy "test_run_items_delete_policy" on public.test_run_items
    for delete to authenticated
    using (public.get_current_user_role() != 'viewer'::user_role);

-- AUDIT_LOGS
create policy "audit_logs_select_policy" on public.audit_logs
    for select to authenticated using (true);

create policy "audit_logs_insert_policy" on public.audit_logs
    for insert to authenticated with check (true);


-- ══════════════════════════════════════════════════════════════
-- PARTE 9: TRIGGERS DE AUDITORIA
-- ══════════════════════════════════════════════════════════════

create or replace function public.log_audit_action()
returns trigger as $$
begin
    insert into public.audit_logs (user_id, action, table_name, record_id)
    values (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        coalesce(NEW.id, OLD.id)
    );
    return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_audit_features on public.features;
create trigger trg_audit_features
    after delete on public.features
    for each row execute function public.log_audit_action();

drop trigger if exists trg_audit_test_runs on public.test_runs;
create trigger trg_audit_test_runs
    after delete or update on public.test_runs
    for each row execute function public.log_audit_action();

drop trigger if exists trg_audit_qa_branches on public.qa_branches;
create trigger trg_audit_qa_branches
    after delete or update on public.qa_branches
    for each row execute function public.log_audit_action();


-- ══════════════════════════════════════════════════════════════
-- PARTE 10: ELEVAR ADMIN
-- ══════════════════════════════════════════════════════════════

update public.users
set role = 'admin'
where lower(email) = 'bruno.melo@insanemedia.com.br';


-- FIM: se chegou aqui sem erros, banco 100% configurado!
