# Fase 2H — cockpit executivo

Status: implementada no app e no projeto Supabase de desenvolvimento em 22/10/2026.

A tela Início passou a abrir com a visão do portfólio autorizado. Os cards de Meet, Mdna, Freneze e Match apresentam o faturamento acumulado do mês e usam cores próprias, entrada progressiva e contagem animada. Tocar no card ou usar **Escolher casa** abre o dashboard daquela unidade sem sair da aba.

O dashboard da casa apresenta faturamento, avanço da meta acumulada, melhor dia, situação de conciliação e uma série diária animada. A interface oferece tema claro/escuro, brilho ambiental, estados de carregamento e erro, e respeita as casas devolvidas pelo bootstrap.

## Contrato remoto

`ghost_dashboard_v2(unit, month)` é somente leitura e valida `auth.uid()`, vínculo ativo, unidade e `dashboard.read`. O faturamento usa o fechamento conciliado de cada turno e recorre à receita bruta ou prevista quando a conciliação ainda não chegou. O retorno marca `provisional` nesse caso e inclui:

- período inicial e final;
- faturamento e meta acumulados até a data atual;
- progresso da meta;
- série diária com faturamento, meta e estado de conciliação.

O cliente não calcula regra financeira, não acessa tabelas e não recebe identificadores fora do bootstrap. TanStack Query mantém os resultados somente em memória e cancela/limpa consultas na troca de contexto.

## Evidências

- [Portfólio](screenshots/home.png)
- [Dashboard da casa](screenshots/dashboard-house.png)

Lint, TypeScript estrito, testes unitários, fronteiras, exportação de todas as plataformas e seis jornadas E2E fazem parte da validação desta entrega. A RPC também foi executada com escopo autorizado no projeto de desenvolvimento e testada sem sessão para confirmar a recusa de acesso anônimo.
