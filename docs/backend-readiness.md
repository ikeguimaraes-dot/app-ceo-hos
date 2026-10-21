# Auditoria e prontidão do backend

## Escopo executado

A auditoria foi feita no projeto de desenvolvimento `kph-os-dev`, sem alterar o repositório KPH. Foram lidos metadados, policies, grants, views, funções e amostras agregadas necessárias para desenhar a superfície móvel. O projeto observado possui 579 tabelas públicas, 576 com RLS, 118 views (77 `security_invoker`) e 237 funções públicas `SECURITY DEFINER`.

Foram encontrados 53 usuários Auth, 53 vínculos em `user_roles`, 12 unidades (9 ativas), e 17 usuários sem vínculo. Os escopos usados hoje são unidade e grupo; nenhum vínculo brand/mixed apareceu na amostra. O advisor também indicou proteção contra senhas vazadas desativada.

O principal risco permanece: 105 funções `SECURITY DEFINER` públicas tinham execução para `anon` e 153 para `authenticated`, além de policies/grants amplos. A rota web de dashboard observada usa credencial administrativa e não serve como API móvel. O Ghost não chama essa rota e não recebeu acesso direto a tabela.

## Mitigação criada para o Ghost

A migration [Ghost mobile API v1](../supabase/migrations/20261021115932_ghost_mobile_api_v1.sql) cria um schema privado e uma allowlist de RPCs. Toda entrada:

1. exige `auth.uid()`;
2. verifica status ativo;
3. deriva unidade por `user_roles` e hierarquia existente;
4. exige capability mapeada no servidor;
5. consulta nomes qualificados com `search_path` vazio;
6. retorna JSON minimizado;
7. revoga `EXECUTE` de `public` e `anon`.

O dashboard calcula receita/meta no banco. O cliente apenas formata BRL e percentual. O schema de instalações push não está exposto e não possui grants para o app. A migration [token push reutilizável](../supabase/migrations/20261021121717_ghost_reusable_push_tokens.sql) mantém um único dono ativo por ambiente/token e permite troca de usuário depois da revogação.

## Testes executados

| Caso | Resultado |
|---|---|
| Bootstrap de identidade vinculada | ativo, quatro unidades e capabilities derivadas |
| Dashboard/pendências/notificações em unidade permitida | payload válido |
| Dashboard em unidade fora do vínculo | negado, SQLSTATE 42501 |
| Identidade inativa | `inactive`, zero unidades |
| Identidade sem vínculo | `unlinked`, zero unidades |
| Chamada anônima ao bootstrap | permissão negada |
| Grants das sete RPCs | `anon=false`, `authenticated=true` |
| HTTP com credencial inválida | login negado |

O caso positivo no banco usou claims de teste dentro de transação/rollback; comprova a lógica SQL, não uma jornada Auth móvel. A jornada positiva real exige credencial de desenvolvimento pertencente ao KPH.

## Gate antes de produção

1. Rotacionar a credencial administrativa exposta e verificar integrações servidoras.
2. Reduzir funções executáveis e policies amplas da superfície legada; rodar regressão web/jobs.
3. Habilitar proteção de senhas vazadas.
4. Testar matriz real multiusuário/multiunidade e revogação durante sessão.
5. Revisar e aprovar o seed role/capability com os donos de Financeiro, Operação e Pessoas.
6. Implantar primeiro em staging e somente depois em produção.
7. Implantar worker/receipts de push e contratos transacionais antes de qualquer aprovação.

Os contratos ainda ausentes estão enumerados em [backend-contracts.md](backend-contracts.md).
