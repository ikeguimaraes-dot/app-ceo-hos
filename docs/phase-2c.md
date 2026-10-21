# Fase 2C — piloto operacional

Implementada e aplicada em 2026-10-21 no projeto Supabase de desenvolvimento `kph-os-dev`. Esta fase amplia somente a API Ghost; o aplicativo continua sem consultar tabelas diretamente e sem lógica financeira no cliente.

## Contratos entregues

- `ghost_pending_items_v2`: paginação keyset com cursor opaco, limite de 1 a 50 itens e revalidação de `pending.read` por unidade.
- `ghost_notifications_v2`: paginação do histórico pertencente a `auth.uid()`, com revalidação de `notifications.read`.
- `ghost_operation_summary_v1`: contagens de manutenção pendente, prioridade e data mais antiga. Nenhum valor financeiro ou detalhe de registro.
- `ghost_people_summary_v1`: headcount e total de ajustes de ponto pendentes. Nenhum nome, documento, salário ou dado individual.
- `ghost_bootstrap_v1`: `accessVersion` agora representa status, piloto, unidades ativas e capabilities resolvidas.

O app revalida o bootstrap a cada minuto enquanto está ativo e sempre que volta ao primeiro plano. Uma mudança de acesso limpa o cache TanStack Query; unidade removida volta ao seletor; usuário suspenso vai para o estado inativo. Cada RPC também revalida status, unidade e capability no momento da consulta.

## Piloto controlado

`ghost_private.pilot_members` guarda a coorte e `ghost_private.pilot_config` controla a aplicação da allowlist. A configuração nasce com `enforced=false`, portanto a migration não bloqueia usuários atuais.

Para iniciar o piloto, um operador autorizado deve, em uma única mudança revisada:

1. inserir somente UUIDs de contas de desenvolvimento já vinculadas em `ghost_private.pilot_members`;
2. validar login, unidade e capabilities de cada conta;
3. definir `pilot_config.enforced=true` e atualizar `updated_at`;
4. confirmar que uma conta fora da coorte recebe status inativo;
5. reverter `enforced=false` se houver impacto inesperado.

Não foram criados usuários sintéticos nem papéis com credencial administrativa. A ativação da coorte aguarda os usuários nomeados do piloto.

## Verificação remota

- as quatro RPCs novas têm `EXECUTE` para `authenticated` e nenhuma para `anon`;
- `ghost_private` possui zero grants de tabela para `anon` ou `authenticated`;
- a configuração do piloto permaneceu com `enforced=false`;
- sete endpoints protegidos foram recusados em chamada anônima, incluindo as quatro RPCs da 2C;
- a migration `20261021213000` foi registrada no histórico remoto após a aplicação transacional.

## Limites preservados

- Ambiente de produção e repositório KPH não foram alterados.
- A allowlist, status e instalações ficam no schema privado, sem grants ao cliente.
- Os cursores não carregam JWT ou dados pessoais e são validados no servidor.
- Operação e Pessoas expõem apenas agregados das fontes já usadas pela API Ghost.
- Aprovações, folha, documentos e decisões financeiras continuam fora do escopo.
