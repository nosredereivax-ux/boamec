# Estrutura SQL

Arquivo principal:

```text
supabase/migrations/202606060001_boamec_saas.sql
```

## Tabelas principais

- `empresas`: dados da oficina, plano, status e marca.
- `usuarios`: vinculo entre Supabase Auth, empresa, cargo e permissoes.
- `assinaturas`: trial, ativo, vencido ou cancelado.
- `clientes`: cadastro completo do cliente.
- `veiculos`: veiculos vinculados ao cliente.
- `mecanicos`: mecanicos e percentual de comissao.
- `fornecedores`: fornecedores de pecas e servicos.
- `produtos`: catalogo e estoque atual.
- `estoque_movimentacoes`: entradas, saidas e ajustes.
- `agenda`: agendamentos que podem virar OS.
- `ordens_servico`: cabecalho da OS.
- `os_itens`: servicos e pecas da OS.
- `financeiro_movimentacoes`: contas a pagar e receber.
- `comissoes`: comissoes por mecanico.
- `logs_acesso`: eventos de acesso.
- `auditoria_alteracoes`: historico de alteracoes sensiveis.

## Campos de seguranca

Tabelas operacionais possuem:

- `empresa_id`
- `criado_por`
- `editado_por`
- `editado_em`

## RLS

Todas as tabelas sensiveis estao com Row Level Security ativo.

Funcoes usadas nas politicas:

- `usuario_empresa_id()`
- `usuario_tem_permissao(permissao)`
- `assinatura_empresa_ativa(empresa)`

## Onboarding

Funcao:

```sql
public.criar_empresa_trial(...)
```

Ela cria a empresa, o administrador e a assinatura trial de 30 dias.
