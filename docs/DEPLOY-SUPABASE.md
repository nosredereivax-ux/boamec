# Guia de deploy Supabase

## 1. Criar projeto

1. Acesse Supabase.
2. Crie um novo projeto.
3. Escolha regiao proxima ao Brasil, quando disponivel.
4. Guarde:
   - Project URL
   - anon public key
   - service role key

## 2. Aplicar banco de dados

Opcao A - SQL Editor:

1. Abra o arquivo:

```text
supabase/migrations/202606060001_boamec_saas.sql
```

2. Cole no SQL Editor do Supabase.
3. Execute.

Opcao B - Supabase CLI:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

## 3. Configurar Auth

Em Authentication > URL Configuration:

- Site URL: `https://app.boamec.com.br`
- Redirect URLs:
  - `https://app.boamec.com.br`
  - `https://*.vercel.app`
  - `http://localhost:8080`

## 4. Criar primeira empresa

1. Crie o usuario administrador em Authentication > Users.
2. Entre no app com esse usuario.
3. Execute a RPC `criar_empresa_trial` ou crie uma tela de onboarding usando a mesma RPC.

## 5. Storage

O migration cria o bucket privado `logos`.

Use caminhos assim:

```text
{empresa_id}/logo.svg
```

## 6. Backups

No Supabase:

- Habilite Point-in-Time Recovery quando o plano permitir.
- Mantenha backup diario automatico.
- Faca export semanal completo para armazenamento externo.
- Defina retencao minima de 30 dias.

Para operacao comercial, use ao menos o plano que ofereca backup adequado para producao.
