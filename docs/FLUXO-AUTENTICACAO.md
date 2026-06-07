# Fluxo de autenticacao

## Login

1. Usuario informa e-mail e senha.
2. Frontend chama `supabase.auth.signInWithPassword`.
3. Supabase Auth valida a senha com armazenamento criptografado no schema interno `auth`.
4. O app busca o perfil em `public.usuarios`.
5. O app busca a empresa em `public.empresas`.
6. O app busca a assinatura ativa em `public.assinaturas`.
7. Se a assinatura estiver vencida, o acesso e bloqueado.
8. Se estiver ativa ou em trial, os modulos sao liberados conforme `permissoes`.

## Permissoes

Perfis base:

- Administrador
- Gerente
- Mecanico
- Financeiro
- Atendente

As permissoes tambem ficam em `usuarios.permissoes`.

Importante: o navegador so melhora a experiencia. A autorizacao real fica no banco via RLS.

## Criacao da primeira empresa

Fluxo recomendado:

1. Criar usuario no Supabase Auth.
2. Chamar RPC `criar_empresa_trial`.
3. O banco cria empresa, administrador e assinatura trial de 30 dias.

Exemplo:

```js
await supabase.rpc("criar_empresa_trial", {
  p_nome_fantasia: "Mario Galinha Auto Mecanica",
  p_razao_social: "M.G. Auto Mecanica Ltda",
  p_cnpj: "00.000.000/0001-00",
  p_telefone: "(61) 98342-5490",
  p_email: "admin@oficina.com",
  p_usuario_nome: "Mario"
});
```

## Sessao persistente

O Supabase mantem a sessao com refresh token e renova JWT automaticamente. O app tambem guarda um marcador local para reabrir na ultima sessao, mas a validade real vem do Supabase.
