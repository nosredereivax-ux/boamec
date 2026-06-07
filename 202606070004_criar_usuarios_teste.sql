-- BOAMEC - preparar teste oficial com 2 usuarios e 2 empresas limpas
-- Rode este arquivo no Supabase > SQL Editor.
--
-- Logins criados/atualizados:
-- teste1@boamec.com / Boamec@2026
-- teste2@boamec.com / Boamec@2026

create extension if not exists pgcrypto;

do $$
declare
  v_user_1 uuid;
  v_user_2 uuid;
  v_empresa_1 uuid;
  v_empresa_2 uuid;
  v_password text := 'Boamec@2026';
  v_permissoes text[] := array[
    'inicio',
    'agenda',
    'os',
    'clientes',
    'financeiro',
    'mecanicos',
    'produtos',
    'relatorios',
    'configuracoes'
  ]::text[];
begin
  -- Usuario 1
  select id into v_user_1
    from auth.users
   where lower(email) = 'teste1@boamec.com'
   limit 1;

  if v_user_1 is null then
    v_user_1 := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    values (
      v_user_1,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'teste1@boamec.com',
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Usuario Teste 01"}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now(),
           raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
           raw_user_meta_data = '{"name":"Usuario Teste 01"}'::jsonb
     where id = v_user_1;
  end if;

  insert into auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_user_1,
    v_user_1::text,
    jsonb_build_object('sub', v_user_1::text, 'email', 'teste1@boamec.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
     set user_id = excluded.user_id,
         identity_data = excluded.identity_data,
         updated_at = now();

  -- Usuario 2
  select id into v_user_2
    from auth.users
   where lower(email) = 'teste2@boamec.com'
   limit 1;

  if v_user_2 is null then
    v_user_2 := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    values (
      v_user_2,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'teste2@boamec.com',
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Usuario Teste 02"}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now(),
           raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
           raw_user_meta_data = '{"name":"Usuario Teste 02"}'::jsonb
     where id = v_user_2;
  end if;

  insert into auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_user_2,
    v_user_2::text,
    jsonb_build_object('sub', v_user_2::text, 'email', 'teste2@boamec.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
     set user_id = excluded.user_id,
         identity_data = excluded.identity_data,
         updated_at = now();

  -- Limpa dados publicos do teste. O login em auth.users permanece.
  delete from public.empresas;
  delete from public.usuarios;

  insert into public.empresas (
    nome_fantasia,
    razao_social,
    telefone,
    email,
    plano,
    status,
    data_vencimento,
    criado_por,
    editado_por
  )
  values (
    'Oficina Teste 01',
    'BOAMEC Teste 01',
    '(61) 98342-5490',
    'teste1@boamec.com',
    'trial',
    'trial',
    now() + interval '30 days',
    v_user_1,
    v_user_1
  )
  returning id into v_empresa_1;

  insert into public.empresas (
    nome_fantasia,
    razao_social,
    telefone,
    email,
    plano,
    status,
    data_vencimento,
    criado_por,
    editado_por
  )
  values (
    'Oficina Teste 02',
    'BOAMEC Teste 02',
    '(61) 98342-5490',
    'teste2@boamec.com',
    'trial',
    'trial',
    now() + interval '30 days',
    v_user_2,
    v_user_2
  )
  returning id into v_empresa_2;

  insert into public.usuarios (
    id,
    empresa_id,
    nome,
    email,
    cargo,
    permissoes,
    status,
    criado_por,
    editado_por
  )
  values
  (
    v_user_1,
    v_empresa_1,
    'Usuario Teste 01',
    'teste1@boamec.com',
    'Administrador',
    v_permissoes,
    'ativo',
    v_user_1,
    v_user_1
  ),
  (
    v_user_2,
    v_empresa_2,
    'Usuario Teste 02',
    'teste2@boamec.com',
    'Administrador',
    v_permissoes,
    'ativo',
    v_user_2,
    v_user_2
  );

  insert into public.assinaturas (
    empresa_id,
    data_inicio,
    data_fim,
    status,
    plano,
    valor,
    criado_por,
    editado_por
  )
  values
  (
    v_empresa_1,
    now(),
    now() + interval '30 days',
    'trial',
    'trial',
    0,
    v_user_1,
    v_user_1
  ),
  (
    v_empresa_2,
    now(),
    now() + interval '30 days',
    'trial',
    'trial',
    0,
    v_user_2,
    v_user_2
  );
end $$;
