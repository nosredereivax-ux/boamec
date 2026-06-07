# BOAMEC - Arquitetura SaaS de producao

## Visao geral

Frontend:

- HTML
- CSS
- JavaScript
- Vercel para hospedagem e HTTPS

Backend:

- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Row Level Security

## Isolamento multiempresa

Todas as tabelas operacionais possuem `empresa_id`.

O usuario autenticado e vinculado na tabela `usuarios`. As politicas RLS usam:

- `auth.uid()`
- `public.usuario_empresa_id()`
- `public.usuario_tem_permissao(permissao)`
- `public.assinatura_empresa_ativa(empresa_id)`

Resultado: uma oficina so acessa registros da propria `empresa_id`.

## Modulos do banco

- `empresas`
- `usuarios`
- `assinaturas`
- `clientes`
- `veiculos`
- `mecanicos`
- `fornecedores`
- `produtos`
- `estoque_movimentacoes`
- `agenda`
- `ordens_servico`
- `os_itens`
- `financeiro_movimentacoes`
- `comissoes`
- `logs_acesso`
- `auditoria_alteracoes`

## Trial e assinatura

Ao criar uma empresa, a funcao `public.criar_empresa_trial(...)` cria:

- empresa
- usuario administrador
- assinatura trial de 30 dias

Quando a assinatura expira, o acesso aos dados operacionais e bloqueado por RLS e pela tela de login.

## Auditoria

Triggers registram alteracoes em:

- `ordens_servico`
- `financeiro_movimentacoes`
- `estoque_movimentacoes`
- `produtos`

Campos padrao:

- `criado_por`
- `editado_por`
- `editado_em`

## Storage

Bucket:

- `logos`

Padrao de caminho:

```text
{empresa_id}/logo.svg
```

As politicas de Storage deixam cada empresa acessar apenas seus arquivos.
