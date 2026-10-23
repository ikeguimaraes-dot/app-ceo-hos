# Plano de qualidade da Ghost IA

Data: 23/10/2026.

## Diagnóstico atual

A Ghost IA já possui uma superfície somente leitura relativamente ampla: 23 datasets autorizados, até quatro rodadas de ferramentas e escopo derivado de `auth.uid()`. O problema principal não é falta de contexto bruto nem ausência de fine-tuning. A arquitetura delega decisões demais ao modelo em uma única conversa: interpretar intenção e datas, escolher dataset, construir filtros, decidir se precisa refinar a consulta, conferir totais e redigir a resposta.

Isso cria cinco fontes de instabilidade:

1. O modelo escolhe livremente entre 23 datasets e só alguns erros de intenção são corrigidos por expressões regulares.
2. Vários datasets devolvem até 200 linhas; quando não há `summary` completo, o modelo precisa interpretar dados demais.
3. Datas relativas, nomes de casas, produtos, fornecedores e perguntas de continuação não possuem um estado conversacional tipado.
4. A resposta final é texto livre. Não existe um validador que prove que cada número, período e casa vieram da evidência retornada.
5. O sistema não guarda perguntas nem respostas. Isso preserva privacidade, mas hoje impede medir quais perguntas falham e criar regressões a partir delas.

Nas últimas 24 horas, a auditoria técnica registrou 18 respostas concluídas e 7 erros `model_unavailable` com DeepSeek, além de uma requisição ainda marcada como iniciada. As respostas concluídas consumiram em média 23.520 tokens de entrada somados entre as rodadas. Esse volume confirma que o fluxo atual envia contexto repetidamente e depende demais do modelo.

## Decisões

### Não fazer fine-tuning agora

Fine-tuning não corrige consulta errada, período errado, soma errada ou ausência de dados no contrato. Primeiro será construída uma camada determinística e uma suíte de avaliação. Fine-tuning só será considerado depois, para estilo e vocabulário, se os testes mostrarem ganho mensurável.

### Não entregar SQL livre ao modelo

O modelo não receberá credencial nem acesso irrestrito ao SQL. A cobertura será ampliada por consultas tipadas, somente leitura, com autorização repetida no banco. Isso permite chegar a praticamente todo dado empresarial útil sem aceitar SQL arbitrário, vazamento entre casas, consultas caras ou acesso acidental a dados pessoais.

### Separar consulta factual de redação

O banco e o código serão responsáveis por datas, escopo, filtros, somas, percentuais, completude e reconciliação. O modelo será responsável por interpretar a pergunta quando necessário e transformar evidências verificadas em uma conversa natural.

## Arquitetura alvo

1. **Entendimento estruturado:** transformar a pergunta em um objeto com intenção, período, casas, métricas, agrupamento, filtros e relação com a mensagem anterior.
2. **Receitas de consulta:** intenções frequentes usam planos mantidos no servidor. Exemplos: faturamento do dia, compra por produto, conta por fornecedor, contas vencidas, comparação de casas, meta e DRE.
3. **Resolução de entidades:** nomes informais como “Meet”, “Mdna”, “luz” e “carne” são associados a casas, fornecedores, produtos e categorias existentes antes da consulta.
4. **Execução autorizada:** RPCs retornam agregados tipados, subtotais por casa, período efetivo, atualização, contagem, limite atingido e avisos de qualidade.
5. **Verificação:** um validador confere números, casas, datas e unidades da resposta contra as evidências. Resposta com afirmação não comprovada é refeita ou devolvida como insuficiente.
6. **Redação conversacional:** o modelo escolhido pelo usuário recebe apenas o pacote de evidências necessário e produz a resposta final.
7. **Estado de conversa:** um estado compacto mantém assunto, período, casas e filtros resolvidos. “E no mês passado?” deixa de depender apenas das últimas mensagens em texto.

## Seletor de modelo no aplicativo

O seletor ficará no topo da aba IA e poderá ser alterado antes de cada pergunta. DeepSeek continuará como padrão. A primeira lista proposta é:

| Nome no app  | OpenRouter ID                      | Uso                                     |
| ------------ | ---------------------------------- | --------------------------------------- |
| DeepSeek     | `deepseek/deepseek-v4.1-flash`     | padrão, rápido e econômico              |
| GPT Luna     | `openai/gpt-6-luna`                | conversa e instruções mais consistentes |
| Gemini Flash | `google/gemini-3.8-flash-20260902` | análise longa e multimodal futura       |
| Claude Opus  | `anthropic/claude-opus-5.5`        | análise mais cuidadosa, custo alto      |

Todos aceitam ferramentas e saída estruturada segundo as páginas atuais do OpenRouter. A lista será uma allowlist do servidor; o aplicativo não poderá enviar um identificador arbitrário. Isso controla compatibilidade, custo e disponibilidade. A preferência será persistida por usuário, o backend validará o modelo em toda requisição e a auditoria registrará o modelo efetivamente usado. Se um modelo estiver indisponível, o app mostrará a falha e poderá oferecer o DeepSeek como alternativa, sem trocar silenciosamente.

Referências atuais: [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash), [GPT-6 Luna](https://openrouter.ai/openai/gpt-6-luna), [Gemini 3.8 Flash](https://openrouter.ai/google/gemini-3.8-flash-20260902) e [Claude Opus 5.5](https://openrouter.ai/anthropic/claude-opus-5.5).

## Fases de execução

### 1. Medição e avaliação

- Criar pelo menos 100 perguntas de referência com resposta esperada, cobrindo períodos, casas, turnos, compras, fornecedores, contas, DRE, pessoas e continuações.
- Incluir como regressões os erros já observados: faturamento diário incompleto, jantar tratado como ausente, compra de carne vazia e conta de luz sem resposta.
- Registrar por requisição, sem dados empresariais brutos: intenção, datasets consultados, filtros, número de rodadas, latência, limites atingidos, validação, modelo, tokens e erro.
- Adicionar avaliação “Ajudou / Não ajudou”. O envio da pergunta, resposta e evidência para diagnóstico será explícito e restrito a feedbacks marcados pelo usuário.

### 2. Núcleo confiável para as perguntas mais frequentes

- Implementar receitas determinísticas para as 30 perguntas executivas mais comuns.
- Centralizar datas relativas no fuso `America/Sao_Paulo`.
- Criar resolução de casa, marca, produto, categoria e fornecedor.
- Fazer todas as somas no banco e devolver `summary`, `byUnit`, `byPeriod`, completude e atualização.
- Impedir respostas finais quando período, escopo ou números não puderem ser comprovados.

### 3. Conversa e seletor de modelos

- Adicionar o seletor com allowlist, DeepSeek padrão e preferência persistida.
- Passar `modelId` pelo `AssistantGateway` e validá-lo na Edge Function.
- Usar saída JSON estruturada para plano e resposta antes de renderizar texto.
- Manter estado tipado de conversa para perguntas de continuação.
- Exibir modelo usado, fontes, período e casas consideradas em cada resposta.

### 4. Cobertura empresarial

- Auditar cada área do KPH e classificar: coberta, parcial, ausente ou bloqueada por sensibilidade.
- Criar contratos para contas a receber, caixa e conciliação, orçamento, CMV e ficha técnica, escala/ponto detalhado, benefícios e marketing.
- Tratar documentos pessoais, saúde, dados bancários e credenciais com capabilities próprias; eles não entram por uma permissão genérica.

### 5. Comparação de modelos e eventual treinamento

- Executar a mesma suíte em todos os modelos da allowlist.
- Medir exatidão factual, completude, escolha de consulta, conversa, latência, erro e custo.
- Ajustar o modelo padrão somente com base nesses resultados.
- Considerar fine-tuning ou destilação apenas se a camada factual já atingir a meta e ainda houver falhas consistentes de linguagem ou intenção.

## Critérios de aceite

- Todo número da resposta deve apontar para um campo retornado pelo banco.
- Nenhuma ausência de evidência pode ser apresentada como valor zero.
- Período, casas e filtros devem aparecer de forma clara quando afetarem a resposta.
- As perguntas de referência prioritárias devem atingir pelo menos 95% de resposta correta e completa.
- Falhas técnicas devem ficar abaixo de 2% no período de piloto.
- Nenhuma consulta pode escapar das casas e capabilities do usuário.
- O custo e a latência por modelo devem ficar visíveis na telemetria antes de ampliar o uso.

## Ordem recomendada

O primeiro ciclo deve entregar junto: suíte de avaliação, receitas das perguntas mais usadas, resposta estruturada/verificada e seletor de modelos. Trocar somente o modelo melhora alguns casos, mas mantém os mesmos bugs de planejamento e dados. Dar mais tabelas ao fluxo atual aumenta o catálogo e tende a piorar a escolha. A melhora duradoura vem de reduzir o que o modelo precisa adivinhar.

## Progresso do primeiro ciclo

Implementado em 23/10/2026:

- seletor no aplicativo com quatro modelos permitidos, DeepSeek como padrão e preferência local por usuário;
- validação da allowlist na Edge Function e registro do modelo realmente usado na auditoria;
- receitas determinísticas para faturamento, compras por item, notas, despesas recorrentes, contas a pagar, vendas por produto, pagamentos, descontos, cancelamentos, estoque, contratos, eventos, reservas, folha, manutenção, pessoas e ausências;
- resolução de datas relativas, nomes abreviados de casas e continuações explícitas como “e no mês passado?”;
- separação de perguntas independentes no histórico e execução de duas perguntas enviadas na mesma mensagem;
- resposta final em JSON estruturado a partir de evidências consultadas diretamente no banco;
- catálogo resumido no contexto para reduzir tokens repetidos;
- regressões automatizadas para os erros já observados no uso real.

Ao final do primeiro ciclo ainda faltavam a suíte ampla de 100 perguntas, validação numérica, feedback do usuário e contratos das áreas classificadas como ausentes na auditoria de cobertura.

Segundo ciclo implementado em 23/10/2026:

- suíte de avaliação com 102 perguntas executivas representativas e 145 testes totais;
- correção de 13 ambiguidades descobertas pela suíte antes da publicação;
- resumo financeiro calculado no PostgreSQL, incluindo totais, meta, atingimento, clientes, ticket médio, provisório e divisão por casa;
- verificador que bloqueia números ausentes nas evidências e pede uma única correção ao modelo antes de falhar com segurança;
- feedback “Ajudou / Não ajudou” vinculado à requisição e ao usuário autenticado, sem armazenar pergunta, resposta ou linhas empresariais;
- telemetria de datasets consultados, chamadas, tentativas de validação, latência, modelo e tokens.

Permanecem pendentes a validação por caminho de evidência para afirmações não numéricas e a auditoria de cobertura das áreas ainda ausentes.

Correção factual adicional em 23/10/2026:

- perguntas de valor comprado por produto ou categoria deixaram de depender do modelo para redigir o resultado;
- o servidor responde diretamente com total, período, número de notas e divisão por casa calculados pelo PostgreSQL;
- “quanto compramos de carne” e a variação “quando compramos de carne” possuem regressões específicas;
- resultados vazios só são declarados quando `lineCount` do banco é zero.

# Implementação atual

O plano agora inclui respostas determinísticas para faturamento, compras por item, notas fiscais, contas a pagar, vendas por produto, pagamentos, descontos, cancelamentos, inventários, contratos, eventos, reservas e folha. A conversa mantém contexto estruturado de área, período, casa e busca. O app também possui um painel de qualidade por modelo em **Mais → Qualidade do Ghost IA**.
