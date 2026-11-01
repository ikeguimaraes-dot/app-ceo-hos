# Reservas do Serena

## Entrega e estado

Reservas substitui Pessoas no rodapé. Pessoas fica em Mais, condicionada a `people.read`.
A tela consulta um dia por vez, com seleção de casa, reservas ativas, pessoas previstas,
confirmadas, pendentes, canceladas e lista de horários, tamanho do grupo, mesa e origem.
Canceladas aparecem na lista e não entram nos totais ativos. O nome do cliente é incluído por solicitação do usuário. Não são enviados
telefones, e-mails, observações ou valores de pagamento.

Correspondências confirmadas pelo usuário:

| Unidade Ghost | Restaurante Serena |
| --- | --- |
| Frêneze | freneze |
| Meet & Eat | meet_and_eat |
| Madonna SP Itaim | madonna_cucina |

Instituto Levvai fica fora por solicitação do usuário. Unidades sem correspondência
exibem estado de casa não conectada, distinto de zero reservas.

## Contrato e autorização

O app usa apenas `ghost_reservations_v1(unit, date)` no projeto KPH de desenvolvimento.
A capability `operation.read` é derivada do bootstrap e revalidada por unidade no servidor.
Cache somente em memória, chave por usuário/unidade/data/geração, sem placeholder da casa anterior.
Atualização a cada minuto enquanto a tela está montada e botão manual.
Datas seguem America/Sao_Paulo.

A migration KPH cria uma tabela privada de correspondências, uma RPC de autorização e
uma RPC que consulta a Edge Function `ghost-reservations` do Serena por HTTPS.
O destino é fixo. O token Bearer do usuário é encaminhado à função, que o apresenta
novamente ao KPH para validar assinatura, validade, usuário, unidade e capability.
Somente então a função consulta a RPC interna do Serena com a credencial servidora
padrão do runtime. Não armazena nem registra tokens. Falhas são fechadas por padrão.
Nenhuma chave recebida na conversa foi copiada para os arquivos.

A fonte é `public.reservas`, não a tabela legada `reservations`. A função interna é
SECURITY INVOKER, sem EXECUTE para PUBLIC/anon/authenticated, somente para a role servidora.
A consulta não altera reservas nem permissões existentes do Serena.

## Implantação ativada em desenvolvimento

- Aplicada no Serena: `supabase/serena/migrations/20261023204047_ghost_serena_source_v1.sql`.
- Aplicada no KPH: `supabase/migrations/20261023204018_ghost_serena_reservations_v1.sql`.
- Implantada no Serena: função `supabase/serena/functions/ghost-reservations/index.ts`,
  com `verify_jwt=false` porque verifica o JWT do outro projeto via KPH na própria função.
- Web publicada em https://app-ceo-hos.vercel.app em 2026-10-23.
  Deploy `dpl_ETPJZNhATsTFJV6QViqSXPy3DJsM`, status READY, alvo Vercel production
  com backend KPH de desenvolvimento. Fonte: workspace com alterações sobre `328c945`.
  A versão iOS Release foi posteriormente compilada pelo Xcode, instalada e aberta
  no iPhone físico conectado em 2026-10-23.

O usuário autorizou explicitamente o encaminhamento do token entre os servidores e a
ativação do backend. A migration KPH e a Edge Function Serena foram implantadas.
O timeout customizado por SET na definição da função foi removido porque o banco gerenciado
não permitiu configurar o parâmetro; a chamada usa o timeout padrão da extensão HTTP.


## Validação

Lint, TypeScript, 193 testes unitários, boundary check, exportações mock/web e
remotas/web/Android/iOS executados. Os seis cenários E2E passaram, incluindo
Reservas no rodapé e Pessoas pelo menu Mais. A tela de Reservas foi inspecionada
visualmente em viewport móvel. Teste negativo HTTP existente passou para 32 RPCs
com SQLSTATE 42501 e login inválido com invalid_credentials. O script agora rejeita erros
de rede como evidência de autorização negada.

No Serena: consulta de Frêneze em 2026-10-23 retornou 12 reservas confirmadas e 37 pessoas;
verificação de grants e chamada como authenticated comprovaram bloqueio da RPC interna.
Advisor de segurança executado; findings legados não foram alterados nesta integração.
Esses testes de banco não equivalem a login móvel ou consulta ponta a ponta.
Sem mudança de módulos nativos; exportação não é build nem validação em aparelho físico.

Validação após ativação: autorização de Frêneze e rejeição de unidade não autorizada
com claims simuladas em transação/rollback; passagem pelo HTTP KPH → Serena com token
inválido corretamente rejeitada. Grants das duas RPCs KPH: anon=false, authenticated=true.
A função interna Serena segue inacessível a anon/authenticated. As três casas retornaram
contagens diretamente no banco em 2026-10-23: Frêneze 12/37, Meet & Eat 29/211,
Madonna 19/67 (reservas ativas/pessoas). Não houve login móvel positivo nesta etapa.

Advisor KPH revisado: RLS sem policies na tabela privada é intencional (sem grants ao
cliente); SECURITY DEFINER das duas RPCs é intencional para consultar o mapeamento privado,
com auth.uid e capability por unidade antes da leitura. Os alertas legados permanecem
fora do escopo. A consulta ponta a ponta com sessão real do usuário ainda deve ser validada.

Smoke test da publicação: HTTP 200, asset de Reservas presente, /reservations e /people
redirecionam ao login sem sessão, zero erros JavaScript no navegador. Build Vercel: 21s.

## Atualização iOS pelo Xcode

Build Release do workspace `ios/Ghostpreview.xcworkspace`, scheme `Ghostpreview`,
concluído em 2026-10-23. Assinatura Apple Development da equipe já configurada
verificada por codesign. Bundle `com.grupomeeteat.ghost.preview` contém
`ghost_reservations_v1`, URL do backend KPH de desenvolvimento e nenhum JWT embutido.
Instalação por cima do aplicativo existente e abertura confirmadas no iPhone 16 Pro Max
físico conectado. Executa com bundle embarcado, sem Metro. Não houve envio para loja
ou TestFlight. A consulta autenticada de reservas na tela não foi inspecionada nesta etapa.

A atualização de 2026-10-23 inclui guestName (cliente_nome) na RPC interna, mantendo
as mesmas permissões. Nome vazio aparece como "Nome não informado". Cards verdes
indicam confirmação, âmbar indicam pendência e rosa indicam cancelamento; todos
mantêm o status em texto e cores adaptadas aos temas claro e escuro.

Validação da atualização de nomes: 193 testes unitários e seis E2E passaram;
lint, TypeScript, exportações mock/remotas e boundary check passaram. Teste remoto
negativo: 32 RPCs negadas e tokens inválidos recusados. Comparação SQL de 13 reservas
de Frêneze confirmou nomes presentes e iguais a cliente_nome, sem imprimir os nomes.
Build iOS Release concluído, assinatura verificada, instalado e aberto no iPhone físico.

Web com nomes e cores publicada em 2026-10-23: deploy
`dpl_ABTFuBA6vPM1ag2W9s6G1sTYuB7z`, READY, domínio app-ceo-hos.vercel.app.

Instalação em segundo iPhone físico (Ike Phone, iPhone 17 Pro Max) em 2026-10-23:
Modo de Desenvolvedor ativado pelo usuário; build Release com assinatura automática
incluindo o novo aparelho, codesign verificado e instalação concluída. A primeira
abertura foi bloqueada pelo iOS aguardando confiança explícita no perfil de desenvolvedor.
Após o usuário confiar no perfil, abertura do Ghost confirmada no segundo iPhone
físico em 2026-10-23. Instalação concluída; login permanece a cargo do usuário.

Em 2026-10-26, build Release atualizado e assinado para o iPhone Itner físico.
Perfil inclui o novo aparelho e expira em 2026-11-02 às 13:39:19 UTC (10:39 Brasília).
Assinatura verificada; instalação concluída. A primeira abertura foi bloqueada pelo
 iOS aguardando confiança explícita no desenvolvedor, a ser confirmada no aparelho.
