# Guia de deploy Vercel

## 1. Publicar no GitHub

Envie a pasta do sistema para um repositorio GitHub.

Pasta raiz recomendada na Vercel:

```text
outputs/oficina-premium-app
```

## 2. Importar projeto na Vercel

1. Acesse Vercel.
2. Clique em Add New Project.
3. Escolha o repositorio GitHub.
4. Configure:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `.`

## 3. Variaveis de ambiente

Configure em Project Settings > Environment Variables:

```text
BOAMEC_ENV=production
BOAMEC_APP_URL=https://app.boamec.com.br
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-publica
BOAMEC_PRIMARY_DOMAIN=boamec.com.br
BOAMEC_APP_DOMAIN=app.boamec.com.br
```

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend publico.

## 4. Deploy automatico

Fluxo:

1. Commit no GitHub.
2. Vercel detecta alteracao.
3. Vercel executa `npm run build`.
4. O script gera `config.js`.
5. O app fica on-line com HTTPS.

## 5. Seguranca no Vercel

O arquivo `vercel.json` ja configura:

- HTTPS/HSTS
- CSP
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Rewrite para SPA

## 6. Teste pos-deploy

Checklist:

- Abrir URL da Vercel.
- Confirmar que a tela de login aparece.
- Entrar com usuario Supabase Auth.
- Confirmar que o usuario tem registro em `public.usuarios`.
- Confirmar que assinatura trial esta ativa.
- Testar clientes, OS, financeiro, agenda e produtos.
