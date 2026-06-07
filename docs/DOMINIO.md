# Guia de dominio

## Dominio principal

Preparado para:

```text
boamec.com.br
```

## Subdominio do app

Aplicacao:

```text
app.boamec.com.br
```

## Configurar na Vercel

1. Abra o projeto na Vercel.
2. Acesse Settings > Domains.
3. Adicione:

```text
app.boamec.com.br
```

4. A Vercel mostrara o registro DNS necessario.

Exemplo comum:

```text
Tipo: CNAME
Nome: app
Valor: cname.vercel-dns.com
```

## Configurar DNS

No provedor do dominio:

1. Acesse DNS.
2. Crie o CNAME indicado pela Vercel.
3. Aguarde propagacao.
4. Volte na Vercel e aguarde validacao.

## HTTPS

A Vercel emite certificado HTTPS automaticamente depois que o dominio e validado.

## Supabase Auth

Depois do dominio ativo, ajuste no Supabase:

- Site URL: `https://app.boamec.com.br`
- Redirect URL: `https://app.boamec.com.br`
