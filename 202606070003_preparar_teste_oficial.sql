-- BOAMEC - limpeza para teste oficial e criacao de 2 empresas isoladas
-- Antes de rodar:
-- 1. Supabase > Authentication > Users > Add user
-- 2. Crie teste1@boamec.com com senha Boamec@2026
-- 3. Crie teste2@boamec.com com senha Boamec@2026
-- 4. Marque os e-mails como confirmados.

do $$
declare
  v_user_1 uuid;
  v_user_2 uuid;
  v_empresa_1 uuid;
  v_empresa_2 uuid;
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
  select id
    into v_user_1
    from auth.users
   where lower(email) = 'teste1@boamec.com'
   limit 1;

  select id
    into v_user_2
    from auth.users
   where lower(email) = 'teste2@boamec.com'
   limit 1;

  if v_user_1 is null or v_user_2 is null then
    raise exception 'Crie primeiro os usuarios teste1@boamec.com e teste2@boamec.com em Authentication > Users no Supabase. Depois rode este SQL novamente.';
  end if;

  -- Limpa os dados publicos do sistema para o teste oficial.
  -- Nao remove contas de login em auth.users.
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
