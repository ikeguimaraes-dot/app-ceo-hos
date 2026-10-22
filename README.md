# Ghost

Cliente móvel KPH em Expo, React Native e TypeScript estrito. A Fase 1A mantém uma demonstração determinística e desconectada; a Fase 1B adiciona autenticação real e uma API móvel mínima no projeto Supabase de desenvolvimento. O aplicativo nunca usa `service_role`, não consulta tabelas diretamente e não contém regras financeiras.

## Aplicação publicada

A versão web de preview está disponível em **https://app-ceo-hos.vercel.app**. Ela usa o adapter remoto e o projeto Supabase de desenvolvimento, com o selo `PREVIEW · REMOTO` visível na interface. As variáveis públicas ficam no Vercel; nenhuma credencial administrativa é aceita pelo build.

O deploy é uma exportação estática do Expo Router com fallback de SPA para que links como `/pending`, `/notifications` e `/auth/reset-password` abram diretamente. A publicação móvel nas lojas continua separada e depende de EAS, APNs/FCM e dos identificadores definitivos.

A distribuição móvel controlada da [Fase 2A](docs/phase-2a.md) usa o projeto EAS `@grupomeeteat/ghost-mobile`, APK interno e build iOS de simulador. O pipeline da [Fase 2B](docs/phase-2b.md) roda fora do cliente e mantém tokens, fila e recibos em schema privado. O iOS físico/TestFlight aguarda a aprovação da inscrição Apple Developer; APNs e FCM permanecem sem credenciais no cliente.

O assistente executivo da [Fase 2G](docs/phase-2g.md) consulta somente as RPCs que a unidade e o usuário já podem acessar. A chave do modelo fica em segredo da Edge Function. O app não recebe essa chave e não envia consultas diretamente ao OpenRouter.

## Executar

Requer Node 22.23+ e npm 10+.

```sh
npm ci
cp .env.example .env.local
npm run web
```

Para o modo mock, mantenha `EXPO_PUBLIC_DATA_MODE=mock`. A conta fictícia é `demo@ghost.invalid`, senha `ghost-demo`; nenhum dado sai do aparelho.

Para desenvolvimento integrado, use `EXPO_PUBLIC_DATA_MODE=remote`, a Project URL e uma **publishable key** do projeto de desenvolvimento. `.env.local` é ignorado pelo Git. Secret key, JWT administrativo e `service_role` são proibidos. O app valida o formato da configuração e falha antes de iniciar se uma chave administrativa for usada.

```sh
npm run android
npm run ios
npm run web
```

Para compilar os projetos nativos gerados localmente:

```sh
npx expo prebuild
npx expo run:android --no-bundler
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npx expo run:ios --no-bundler
```

Nenhum desses comandos publica build, EAS Update ou app de loja.

O fluxo de entrega web usa `npm run vercel-build` e publica `dist/` conforme [vercel.json](vercel.json). Desenvolvimento local é opcional; a entrega compartilhável é a URL do Vercel acima.

## Backend da Fase 1B

O adapter real usa Supabase Auth com sessão em SecureStore, PKCE para recuperação, refresh ligado ao estado do app e RPCs autenticadas versionadas. A Fase 2C adiciona paginação e resumos mínimos; a Fase 2E preserva a identidade da instalação entre sessões para reconciliar push com segurança:

- `ghost_bootstrap_v1`
- `ghost_dashboard_v1`
- `ghost_pending_items_v1`
- `ghost_notifications_v1`
- `ghost_notification_mark_read_v1`
- `ghost_register_installation_v1`
- `ghost_reconcile_installation_v1`
- `ghost_unregister_installation_v1`
- `ghost_notification_preferences_v1`
- `ghost_notification_preferences_update_v1`
- `ghost_pending_items_v2`
- `ghost_decide_pending_v1`
- `ghost_notifications_v2`
- `ghost_operation_summary_v1`
- `ghost_people_summary_v1`
- `ghost_assistant_begin_v1`
- `ghost_assistant_finish_v1`

As RPCs derivam o usuário de `auth.uid()`, validam vínculo, status, unidade e capability no servidor. `anon` não possui `EXECUTE`. O app usa Zod para rejeitar respostas fora do contrato e TanStack Query somente em memória. As migrations auditáveis estão em [supabase/migrations](supabase/migrations); nesta sessão foram aplicadas apenas ao projeto `kph-os-dev`.

O chat é somente leitura. A Edge Function envia ao provedor externo apenas agregados autorizados da unidade atual: faturamento/meta do mês, contagens de manutenção, headcount, ajustes de ponto e até dez títulos de pendências. IDs, versões, direitos de decisão, detalhes livres e identidades de funcionários são removidos. Perguntas e respostas ficam somente na memória da tela; o banco registra apenas metadados técnicos por 30 dias para limite e auditoria.

Login inválido e acesso anônimo foram verificados contra o ambiente remoto. O teste positivo completo pelo aplicativo requer uma conta KPH de desenvolvimento já vinculada; uma conta sintética não foi criada com credencial administrativa.

## Navegação e links

As cinco áreas são Início, Pendências, Operação, Pessoas e Mais. Bootstrap decide as capabilities por unidade; a UI não codifica papéis. Sem vínculo, inativo, sessão expirada, offline, vazio, erro e retry possuem estados próprios.

Schemes: `ghost-local`, `ghost-preview` e `ghost-production`. Links autenticados aceitos incluem `/notifications`, `/pending` e `/assistant`; sem sessão, o destino fica pendente até login e seleção de unidade. Recuperação usa `/auth/reset-password` e troca a senha somente depois de uma sessão de recovery válida.

Push pede permissão depois da explicação e do login. O token fica em tabela privada, associado ao usuário autenticado e à instalação. Preferências são versionadas, o payload é genérico e os toques em notificações aceitam apenas rotas locais permitidas. Envio e receipts passam pela Edge Function protegida por segredo; entrega em aparelhos ainda depende das credenciais APNs/FCM descritas em [contratos restantes](docs/backend-contracts.md).

## Verificações

```sh
npm run lint
npm run typecheck
npm test
npm run check:boundaries
npm run check:release
npm run test:remote:negative
npm run export:mock
npm run export:remote
npm run test:e2e
python3 scripts/check_docs.py
```

`check:boundaries` rejeita segredo/JWT e acesso `.from(...)` no cliente. `check:release` resolve as configurações públicas local, preview e produção e valida IDs nativos, perfis EAS, OTA desativado, declaração iOS e saída Vercel. `test:remote:negative` lê somente a configuração gitignored e confirma endpoint público, rejeição de credencial inválida e bloqueio da RPC para anônimo.

## Estrutura

- `app/`: rotas públicas, protegidas, callback de senha e cinco abas.
- `src/contracts/`: contratos independentes de transporte.
- `src/data/`: adapters mock e Supabase; telas recebem gateways pelo provider.
- `src/state/`: sessão, capabilities, troca de unidade, cancelamento e limpeza.
- `src/security/`: adapter chunked de SecureStore e identificador de instalação.
- `src/notifications/`: validação de payload e destino local de notificações.
- `src/ui/`: tokens, tema claro/escuro e componentes; catálogo interno em `/catalog`.
- `supabase/migrations/`: fronteira móvel privada e RPCs versionadas.
- `supabase/functions/` e `supabase/schedules/`: worker de push e agendamento sem segredos versionados.

Veja [entrega da Fase 1B](docs/phase-1b.md), [distribuição da Fase 2A](docs/phase-2a.md), [notificações da Fase 2B](docs/phase-2b.md), [piloto operacional da Fase 2C](docs/phase-2c.md), [decisões transacionais da Fase 2D](docs/phase-2d.md), [confiabilidade da Fase 2E](docs/phase-2e.md), [prontidão de release da Fase 2F](docs/phase-2f.md), [assistente executivo da Fase 2G](docs/phase-2g.md), [arquitetura](docs/architecture.md), [contratos restantes](docs/backend-contracts.md), [validação](docs/validation.md) e [checklist Android/iOS](docs/device-checklist.md). A [Fase 1A](docs/phase-1a.md) permanece documentada como baseline mock.
