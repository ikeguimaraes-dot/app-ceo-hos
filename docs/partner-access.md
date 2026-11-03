# Acesso de sócios — faturamento e metas

O Ghost usa a mesma aplicação para contas completas e contas de sócios.
O papel `socio_readonly` recebe somente `dashboard.read`. As duas contas solicitadas
foram criadas pelo Supabase Auth e vinculadas individualmente às quatro casas:
Meet & Eat, Match Point, Madonna SP Itaim e Frêneze. As senhas não são persistidas
no repositório, scripts, testes ou documentação.

## Autorização

- `payables.read` autoriza contas a pagar e fluxo de caixa. Todas as versões
  públicas dessas RPCs passaram a exigir essa permissão.
- `dashboard.details` autoriza os indicadores adicionais do restaurante.
  Sem ela, todas as versões públicas do dashboard retornam uma lista permitida
  de faturamento, metas, projeção e receita por turno/eventos; recebido, dívida,
  descontos, gorjetas, clientes, ticket e CMV ficam nulos. Campos futuros não
  entram automaticamente na resposta restrita.
- Implementações completas do dashboard ficam no schema privado, sem execução
  por anon/authenticated. A composição financeira interna permanece no servidor.
- `ghost_bootstrap_v2` inclui as novas permissões. A v1 mantém o vocabulário antigo
  para compatibilidade com aplicativos já instalados. `accessVersion` inclui as
  capabilities; mudanças invalidam o contexto e cache em memória.
- NF e Reservas exigem `operation.read`; IA exige `assistant.ask`, inclusive o
  painel auxiliar de qualidade. Pessoas, pendências e notificações não são
  concedidas aos sócios.
- Permissões completas existentes foram preservadas para os demais papéis que
  já acessavam o dashboard. Novos papéis precisam de concessões explícitas.

## Interface e distribuição

Para os sócios, a navegação mantém Início e Mais (perfil, preferências e sair).
A pagar, IA, NF e Reservas são ocultados. Links para módulos não autorizados
não concedem acesso. O aplicativo consulta apenas RPCs Ghost versionadas.

A versão nova do app é necessária para a apresentação restrita. Versões antigas
podem ainda mostrar o ícone A pagar, mas a consulta é negada pelo servidor.
Não foram alterados módulos nativos nem o repositório KPH de referência.

## Validação

- 221 testes unitários; dez E2E, incluindo menu reduzido, faturamento/eventos,
  ausência dos detalhes restritos, logout e link para contas a pagar.
- Lint, TypeScript, limites de acesso e gate de release.
- Teste remoto negativo: 35 RPCs anônimas negadas, credencial inválida negada,
  integrações Serena/Eventos rejeitando tokens ausentes e inválidos.
- `supabase/tests/partner-dashboard.sql`: preservação de receita/metas,
  minimização inclusive de campos futuros e grants privados.
- Exportações remotas Android/iOS/web e exportação mock web.
- Testes HTTP Auth/RPC não equivalem a instalação ou jornada em aparelho físico.
- Auth HTTP real de cada sócio: login válido, quatro casas, dashboards v1–v4
  minimizados, unidade fora do escopo negada e 11 RPCs de módulos não concedidos
  negadas com `42501`. Consulta legada da IA retorna zero registros autorizados.
- Conta completa de revisão: bootstrap v1 compatível, v2 com permissões completas,
  contas a pagar acessível e exemplo de eventos de 27/10 preservado.
- Houve erros transitórios de transporte/HTTP 520 durante a verificação externa;
  a verificação HTTP final passou com timeout e retentativas limitadas.

## Publicação

- Implementação: commit `dc15b2c`, enviado ao GitHub.
- Web: https://app-ceo-hos.vercel.app, implantação
  `dpl_DprLgoGjpZn27hyHJkhuEG7a3GXS`, READY e promovida ao domínio canônico.
  HTML e bundle confirmados com RPC v2 e as duas permissões novas.
- iOS: `0.1.0 (8)`, build `7e6fbf6d-290d-434e-9d1b-960b20980e9b`;
  submissão automática `529e9921-e398-4beb-a903-df89cf32954b` agendada.
- Link público preservado: https://testflight.apple.com/join/41JRK7ea.
  Build e submissão ainda precisam concluir; isso não significa disponibilidade
  para instalação externa no TestFlight.
- Jornada web real no domínio canônico com a conta de Paulo: login, menu reduzido,
  faturamento sem detalhes restritos e logout passaram; zero erros de página no
  Chrome com viewport móvel. Não é validação de aparelho físico.
