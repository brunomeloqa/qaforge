-- ==============================================================================
-- FIX: Trigger handle_new_user com search_path correto (padrão Supabase)
-- Rode este script no SQL Editor do Supabase
-- ==============================================================================

-- 1. Recriar a função com set search_path = public (resolve tipos e tabelas)
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
    v_role user_role := 'qa';
begin
    -- Bloquear emails fora do domínio corporativo
    if lower(new.email) not like '%@insanemedia.com.br' then
        raise exception 'Apenas e-mails @insanemedia.com.br são autorizados.';
    end if;

    -- Auto-admin para bruno.melo
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
$$;

-- 2. Recriar o trigger (garante que está apontando para a nova versão da função)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- 3. Garantir que a service_role tem acesso total à tabela users
--    (necessário para o trigger funcionar em qualquer contexto do Supabase)
drop policy if exists "users_service_policy" on public.users;
create policy "users_service_policy" on public.users
    for all to service_role
    using (true)
    with check (true);

-- 4. Diagnóstico: ver usuários existentes e políticas ativas
select email, role, created_at from public.users order by created_at desc;

select policyname, cmd, roles::text
from pg_policies
where tablename = 'users'
order by policyname;
