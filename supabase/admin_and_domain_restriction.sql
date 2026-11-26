-- ==============================================================================
-- RESTRIÇÃO DE DOMÍNIO (@insanemedia.com.br) E PRIVILÉGIOS DE ADMIN
-- ==============================================================================

-- 1. Atualizar o gatilho de criação de usuário para validar domínio e conceder admin ao Bruno
create or replace function public.handle_new_user()
returns trigger as $$
declare
    v_role user_role := 'qa';
begin
    -- Validar se o e-mail pertence ao domínio corporativo @insanemedia.com.br
    if lower(new.email) not like '%@insanemedia.com.br' then
        raise exception 'Apenas e-mails corporativos @insanemedia.com.br são autorizados a acessar o sistema.';
    end if;

    -- Conceder privilégio de Admin automaticamente ao Bruno Melo
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

-- 2. Elevar imediatamente o perfil de bruno.melo@insanemedia.com.br para 'admin' (se já logou ou quando logar)
update public.users
set role = 'admin'
where lower(email) = 'bruno.melo@insanemedia.com.br';
