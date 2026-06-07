-- BOAMEC SaaS initial production schema
-- Apply in Supabase SQL editor or with: supabase db push

create extension if not exists pgcrypto;

do $$ begin
  create type public.usuario_status as enum ('ativo', 'inativo', 'bloqueado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assinatura_status as enum ('trial', 'ativo', 'vencido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_status as enum ('Aberta', 'Aguardando aprovacao', 'Em andamento', 'Finalizada', 'Paga', 'Pendente', 'Cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financeiro_tipo as enum ('receber', 'pagar');
exception when duplicate_object then null; end $$;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  logo_url text,
  cor_primaria text default '#5368e8',
  plano text not null default 'trial',
  status text not null default 'trial',
  data_vencimento timestamptz,
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  email text not null unique,
  senha_hash text,
  cargo text not null check (cargo in ('Administrador', 'Gerente', 'Mecanico', 'Financeiro', 'Atendente')),
  permissoes text[] not null default array['inicio']::text[],
  status public.usuario_status not null default 'ativo',
  ultimo_login timestamptz,
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  data_inicio timestamptz not null default now(),
  data_fim timestamptz not null default now() + interval '30 days',
  status public.assinatura_status not null default 'trial',
  plano text not null default 'trial',
  valor numeric(12,2) not null default 0,
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cpf_cnpj text,
  email text,
  telefones text[] not null default '{}',
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  observacoes text,
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  placa text not null,
  modelo text not null,
  marca text,
  ano text,
  cor text,
  km_atual integer,
  observacoes text,
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now(),
  unique (empresa_id, placa)
);

create table if not exists public.mecanicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  percentual_comissao numeric(5,2) not null default 0,
  status text not null default 'ativo',
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  status text not null default 'ativo',
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fornecedor_id uuid references public.fornecedores(id),
  codigo text not null,
  nome text not null,
  descricao text,
  categoria text,
  unidade text not null default 'un',
  estoque_atual numeric(12,3) not null default 0,
  estoque_minimo numeric(12,3) not null default 0,
  preco_custo numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  status text not null default 'ativo',
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists public.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(12,3) not null,
  valor_unitario numeric(12,2) not null default 0,
  origem text,
  observacao text,
  data_movimento timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid references public.clientes(id),
  veiculo_id uuid references public.veiculos(id),
  mecanico_id uuid references public.mecanicos(id),
  cliente_nome text not null,
  telefone text,
  veiculo text,
  placa text,
  cor text,
  data_agendada date not null,
  hora_agendada time not null,
  servico_previsto text,
  mecanico_nome text,
  status text not null default 'agendado',
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  numero bigint not null,
  cliente_id uuid references public.clientes(id),
  veiculo_id uuid references public.veiculos(id),
  mecanico_id uuid references public.mecanicos(id),
  cliente_nome text not null,
  telefone text,
  veiculo text,
  placa text,
  cor text,
  km integer,
  relato_cliente text,
  situacao_entrada text,
  status public.os_status not null default 'Aberta',
  valor_mao_obra numeric(12,2) not null default 0,
  valor_pecas numeric(12,2) not null default 0,
  valor_desconto numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  pago boolean not null default false,
  forma_pagamento text,
  data_abertura timestamptz not null default now(),
  data_finalizacao timestamptz,
  data_pagamento timestamptz,
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now(),
  unique (empresa_id, numero)
);

create table if not exists public.os_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  os_id uuid not null references public.ordens_servico(id) on delete cascade,
  produto_id uuid references public.produtos(id),
  tipo text not null check (tipo in ('servico', 'peca')),
  descricao text not null,
  quantidade numeric(12,3) not null default 1,
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) generated always as (quantidade * valor_unitario) stored,
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.financeiro_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  os_id uuid references public.ordens_servico(id),
  fornecedor_id uuid references public.fornecedores(id),
  tipo public.financeiro_tipo not null,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null,
  desconto numeric(12,2) not null default 0,
  valor_pago numeric(12,2) not null default 0,
  forma_pagamento text,
  vencimento date,
  data_pagamento timestamptz,
  status text not null default 'pendente',
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.comissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  os_id uuid not null references public.ordens_servico(id) on delete cascade,
  mecanico_id uuid references public.mecanicos(id),
  mecanico_nome text not null,
  percentual numeric(5,2) not null default 0,
  valor_base numeric(12,2) not null default 0,
  valor numeric(12,2) not null default 0,
  pago boolean not null default false,
  forma_pagamento text,
  data_pagamento timestamptz,
  data_criacao timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  editado_por uuid references auth.users(id),
  editado_em timestamptz not null default now()
);

create table if not exists public.logs_acesso (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  email text,
  acao text not null,
  ip inet,
  user_agent text,
  data_evento timestamptz not null default now()
);

create table if not exists public.auditoria_alteracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  tabela text not null,
  registro_id uuid,
  operacao text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  data_evento timestamptz not null default now()
);

create or replace function public.usuario_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id
  from public.usuarios
  where id = auth.uid()
    and status = 'ativo'
  limit 1
$$;

create or replace function public.usuario_tem_permissao(permissao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios
    where id = auth.uid()
      and status = 'ativo'
      and (
        cargo = 'Administrador'
        or permissao = any(permissoes)
      )
  )
$$;

create or replace function public.assinatura_empresa_ativa(empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assinaturas
    where empresa_id = empresa
      and status in ('trial', 'ativo')
      and data_fim >= now()
    order by data_fim desc
    limit 1
  )
$$;

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_por is null then
      new.criado_por := auth.uid();
    end if;
  end if;
  new.editado_por := auth.uid();
  new.editado_em := now();
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  empresa uuid;
  registro uuid;
begin
  empresa := coalesce(new.empresa_id, old.empresa_id);
  registro := coalesce(new.id, old.id);
  insert into public.auditoria_alteracoes (
    empresa_id,
    usuario_id,
    tabela,
    registro_id,
    operacao,
    dados_anteriores,
    dados_novos
  )
  values (
    empresa,
    auth.uid(),
    tg_table_name,
    registro,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.criar_empresa_trial(
  p_nome_fantasia text,
  p_razao_social text default null,
  p_cnpj text default null,
  p_telefone text default null,
  p_email text default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if exists (select 1 from public.usuarios where id = v_user_id) then
    raise exception 'Usuario ja vinculado a uma empresa';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  insert into public.empresas (
    nome_fantasia,
    razao_social,
    cnpj,
    telefone,
    email,
    plano,
    status,
    data_vencimento,
    criado_por
  )
  values (
    p_nome_fantasia,
    p_razao_social,
    p_cnpj,
    p_telefone,
    coalesce(p_email, v_email),
    'trial',
    'trial',
    now() + interval '30 days',
    v_user_id
  )
  returning id into v_empresa_id;

  insert into public.usuarios (
    id,
    empresa_id,
    nome,
    email,
    cargo,
    permissoes,
    status,
    criado_por
  )
  values (
    v_user_id,
    v_empresa_id,
    coalesce(p_usuario_nome, split_part(v_email, '@', 1)),
    v_email,
    'Administrador',
    array['inicio','agenda','os','clientes','financeiro','mecanicos','produtos','relatorios','configuracoes']::text[],
    'ativo',
    v_user_id
  );

  insert into public.assinaturas (
    empresa_id,
    data_inicio,
    data_fim,
    status,
    plano,
    valor,
    criado_por
  )
  values (
    v_empresa_id,
    now(),
    now() + interval '30 days',
    'trial',
    'trial',
    0,
    v_user_id
  );

  return v_empresa_id;
end;
$$;

do $$ declare
  t text;
  trigger_name text;
begin
  foreach t in array array[
    'empresas','usuarios','assinaturas','clientes','veiculos','mecanicos',
    'fornecedores','produtos','estoque_movimentacoes','agenda',
    'ordens_servico','os_itens','financeiro_movimentacoes','comissoes'
  ] loop
    trigger_name := 'trg_' || t || '_audit_fields';
    execute format('drop trigger if exists %I on public.%I', trigger_name, t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_audit_fields()', trigger_name, t);
  end loop;
end $$;

do $$ declare
  t text;
  trigger_name text;
begin
  foreach t in array array['ordens_servico','financeiro_movimentacoes','estoque_movimentacoes','produtos'] loop
    trigger_name := 'trg_' || t || '_audit_row';
    execute format('drop trigger if exists %I on public.%I', trigger_name, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', trigger_name, t);
  end loop;
end $$;

alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
alter table public.assinaturas enable row level security;
alter table public.clientes enable row level security;
alter table public.veiculos enable row level security;
alter table public.mecanicos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.produtos enable row level security;
alter table public.estoque_movimentacoes enable row level security;
alter table public.agenda enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.os_itens enable row level security;
alter table public.financeiro_movimentacoes enable row level security;
alter table public.comissoes enable row level security;
alter table public.logs_acesso enable row level security;
alter table public.auditoria_alteracoes enable row level security;

drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas
for select to authenticated
using (id = public.usuario_empresa_id());

drop policy if exists empresas_update on public.empresas;
create policy empresas_update on public.empresas
for update to authenticated
using (id = public.usuario_empresa_id() and public.usuario_tem_permissao('configuracoes'))
with check (id = public.usuario_empresa_id() and public.usuario_tem_permissao('configuracoes'));

drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
for select to authenticated
using (empresa_id = public.usuario_empresa_id() and (id = auth.uid() or public.usuario_tem_permissao('configuracoes')));

drop policy if exists usuarios_write on public.usuarios;
create policy usuarios_write on public.usuarios
for all to authenticated
using (empresa_id = public.usuario_empresa_id() and public.usuario_tem_permissao('configuracoes'))
with check (empresa_id = public.usuario_empresa_id() and public.usuario_tem_permissao('configuracoes'));

drop policy if exists assinaturas_select on public.assinaturas;
create policy assinaturas_select on public.assinaturas
for select to authenticated
using (empresa_id = public.usuario_empresa_id());

drop policy if exists logs_select on public.logs_acesso;
create policy logs_select on public.logs_acesso
for select to authenticated
using (empresa_id = public.usuario_empresa_id() and public.usuario_tem_permissao('configuracoes'));

drop policy if exists auditoria_select on public.auditoria_alteracoes;
create policy auditoria_select on public.auditoria_alteracoes
for select to authenticated
using (empresa_id = public.usuario_empresa_id() and public.usuario_tem_permissao('configuracoes'));

do $$ declare
  t text;
  p text;
begin
  foreach t in array array['clientes','veiculos','agenda'] loop
    p := t || '_tenant_all';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''clientes'')) with check (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''clientes''))',
      p, t
    );
  end loop;

  foreach t in array array['ordens_servico','os_itens'] loop
    p := t || '_tenant_all';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''os'')) with check (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''os''))',
      p, t
    );
  end loop;

  foreach t in array array['financeiro_movimentacoes','comissoes'] loop
    p := t || '_tenant_all';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''financeiro'')) with check (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''financeiro''))',
      p, t
    );
  end loop;

  foreach t in array array['mecanicos'] loop
    p := t || '_tenant_all';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''mecanicos'')) with check (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''mecanicos''))',
      p, t
    );
  end loop;

  foreach t in array array['fornecedores','produtos','estoque_movimentacoes'] loop
    p := t || '_tenant_all';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''produtos'')) with check (empresa_id = public.usuario_empresa_id() and public.assinatura_empresa_ativa(empresa_id) and public.usuario_tem_permissao(''produtos''))',
      p, t
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

drop policy if exists logos_select_own_company on storage.objects;
create policy logos_select_own_company on storage.objects
for select to authenticated
using (
  bucket_id = 'logos'
  and split_part(name, '/', 1) = public.usuario_empresa_id()::text
);

drop policy if exists logos_write_own_company on storage.objects;
create policy logos_write_own_company on storage.objects
for all to authenticated
using (
  bucket_id = 'logos'
  and split_part(name, '/', 1) = public.usuario_empresa_id()::text
  and public.usuario_tem_permissao('configuracoes')
)
with check (
  bucket_id = 'logos'
  and split_part(name, '/', 1) = public.usuario_empresa_id()::text
  and public.usuario_tem_permissao('configuracoes')
);

create index if not exists idx_usuarios_empresa on public.usuarios(empresa_id);
create index if not exists idx_assinaturas_empresa_status on public.assinaturas(empresa_id, status, data_fim);
create index if not exists idx_clientes_empresa_nome on public.clientes(empresa_id, nome);
create index if not exists idx_veiculos_empresa_placa on public.veiculos(empresa_id, placa);
create index if not exists idx_agenda_empresa_data on public.agenda(empresa_id, data_agendada);
create index if not exists idx_os_empresa_numero on public.ordens_servico(empresa_id, numero desc);
create index if not exists idx_os_empresa_status on public.ordens_servico(empresa_id, status);
create index if not exists idx_financeiro_empresa_vencimento on public.financeiro_movimentacoes(empresa_id, vencimento, status);
create index if not exists idx_comissoes_empresa_pago on public.comissoes(empresa_id, pago);
create index if not exists idx_produtos_empresa_nome on public.produtos(empresa_id, nome);
create index if not exists idx_estoque_empresa_produto on public.estoque_movimentacoes(empresa_id, produto_id, data_movimento desc);
