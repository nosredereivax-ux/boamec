# Backup e operacao

## Politica recomendada

Diario:

- Backup automatico do Supabase.
- Verificacao de saude do banco.

Semanal:

- Export completo do PostgreSQL.
- Copia fora do Supabase, por exemplo storage privado, S3 ou Google Cloud Storage.

Retencao:

- 30 dias para backups diarios.
- 12 semanas para backups semanais.
- 12 meses para fechamento mensal, quando houver obrigacao fiscal/contabil.

## Restauracao

Todo backup deve ser testado. Rotina minima:

1. Criar ambiente de homologacao.
2. Restaurar backup.
3. Conferir login.
4. Conferir OS, financeiro, estoque e agenda.

## Auditoria

As tabelas de auditoria guardam:

- usuario
- tabela alterada
- registro alterado
- operacao
- dados anteriores
- dados novos
- data

Use essas informacoes para investigar exclusoes, recebimentos, pagamentos e ajustes de estoque.

## Logs de acesso

A tabela `logs_acesso` esta pronta para registrar acessos. Em producao, registre login, logout, tentativas negadas e renovacoes de assinatura.
