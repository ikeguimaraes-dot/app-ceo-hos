# Entrega da Fase 1B

## Resultado

A fundação Ghost possui dois adapters intercambiáveis. `mock` preserva a demonstração offline da Fase 1A. `remote` usa Supabase Auth e uma superfície móvel específica no projeto de desenvolvimento. Nenhuma tela conhece o transporte, nenhuma consulta direta a tabela existe no app e nenhuma credencial administrativa foi usada no runtime móvel.

## API móvel implantada em desenvolvimento

Três migrations aditivas foram aplicadas ao `kph-os-dev`:

1. `20261021115932_ghost_mobile_api_v1.sql`: schema privado, status de conta, matriz role/capability, instalações push e sete RPCs públicas autenticadas.
2. `20261021121717_ghost_reusable_push_tokens.sql`: permite reutilizar token Expo revogado em aparelho compartilhado, mantendo unicidade entre vínculos ativos.
3. `20261021122850_ghost_push_requires_link.sql`: nega registro push para conta sem vínculo KPH ativo, mantendo revogação disponível depois de desvincular.

O bootstrap retorna estado `active`, `unlinked` ou `inactive`, unidades e capabilities por unidade. Dashboard consolida receita Lorean e meta no servidor. Pendências expõem manutenção e ajustes de ponto já escopados. Notificações pertencem ao usuário. Registro push deriva o dono de `auth.uid()` e grava em schema fora da Data API.

As funções usam `SECURITY DEFINER` com `search_path` vazio, nomes totalmente qualificados, validação explícita de sessão e escopo, e grants somente para `authenticated`. O cliente recebe JSON mínimo e valida cada payload com Zod.

## Sessão móvel

O Supabase JS persiste somente a sessão nativa em SecureStore. Valores grandes são divididos em partes com nomes aceitos pelo keychain; não existe fallback para AsyncStorage. No web a sessão é apenas memória. O fluxo de recuperação usa PKCE, scheme por ambiente e uma tela exclusiva de nova senha. Auto-refresh inicia em foreground e para em background.

Logout tenta revogar primeiro a instalação push com a sessão válida, encerra Auth e sempre limpa queries, unidade, link pendente e armazenamento local. Uma falha de rede não mantém dados locais.

## Evidência executada

- RPC positiva com identidade vinculada simulada no banco: bootstrap ativo, quatro unidades e payloads de dashboard/pendências/notificações válidos.
- Unidade fora do escopo: negada com `42501`.
- Usuário inativo e sem vínculo: nenhum acesso a unidade.
- Todas as sete RPCs: `anon` sem `EXECUTE`, `authenticated` com `EXECUTE`.
- Registro push: usuário vinculado aceito em rollback; usuário sem vínculo negado.
- Teste HTTP com publishable key: endpoint público acessível, login inválido rejeitado e bootstrap anônimo negado.
- Auth URL Configuration: redirects `ghost-local`, `ghost-preview`, `ghost-production` e `https://app-ceo-hos.vercel.app/auth/reset-password` cadastrados; total confirmado de nove URLs permitidas.
- iOS: Xcode build concluído, app instalado e aberto; SecureStore real validado após corrigir separador incompatível.
- Android: build/instalação local registrados em [validação](validation.md).
- Lint, TypeScript, testes, boundary check, exportações e E2E registrados em [validação](validation.md).
- Web de preview exportada pelo Expo, implantada no Vercel e validada em `/`, `/pending` e assets versionados; URL canônica `https://app-ceo-hos.vercel.app`.

## Entrega web

O Vercel compila `npm run vercel-build`, publica somente `dist/` e reescreve rotas de aplicação para `index.html`. Os ambientes Preview e Production do projeto Vercel usam `EXPO_PUBLIC_APP_ENV=preview` e `EXPO_PUBLIC_DATA_MODE=remote`, porque ambos apontam para o backend de desenvolvimento. Isso mantém a natureza de homologação explícita mesmo na URL estável.

A configuração pública contém somente Project URL e publishable key. `service_role`, secret key e JWT administrativo permanecem rejeitados pelo boundary check e pela validação de ambiente.

## Fora desta entrega

Não houve alteração no repositório KPH, implantação no backend de produção, EAS Build, EAS Update, Submit, criação de conta, envio de push ou decisão financeira. A URL pública é uma homologação conectada ao projeto de desenvolvimento. A superfície legada ampla do banco continua sendo risco de plataforma e precisa de saneamento antes de produção; as RPCs Ghost não concedem novos acessos diretos a ela.
