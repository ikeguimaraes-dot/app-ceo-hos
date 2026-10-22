-- Clarify that partial status means pending payment reconciliation while all
-- imported shifts remain included in the reported revenue.
create or replace function public.ghost_assistant_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not exists (
    select 1 from public.units u
    where u.active is true
      and ghost_private.user_has_capability(v_user_id, u.id, 'assistant.ask')
  ) then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  return jsonb_build_object(
    'datasets', jsonb_build_array(
      jsonb_build_object('name','financeiro','capability','dashboard.read','dateField','period','description','Faturamento por turno e período, receitas, descontos, gorjetas, custo, lucro, clientes, ticket, pagamentos e metas. reportedRevenue inclui todos os turnos importados. provisional significa somente que a conciliação das formas de pagamento de incompleteShifts ainda não chegou e o total pode sofrer pequeno ajuste. Aceita grain day ou month.','fields',jsonb_build_array('unitName','brand','group','period','reportedRevenue','closedRevenue','receivedRevenue','grossRevenue','netRevenue','discount','tips','cost','profit','customers','averageTicket','goal','difference','shifts','shiftCount','closedShiftCount','incompleteShifts','provisional','qualityWarning')),
      jsonb_build_object('name','dre_mensal','capability','dashboard.read','dateField','month','description','DRE consolidada mensal por casa.','fields',jsonb_build_array('unitName','month','type','grossRevenue','cmv','people','occupancy','utilities','operation','maintenance','administrative','marketing','cardFees','taxes','ebitda','netResult','customers','averageTicket')),
      jsonb_build_object('name','dre_detalhes','capability','dashboard.read','dateField','month','description','Linhas detalhadas da DRE por grupo, conta e tipo de custo.','fields',jsonb_build_array('unitName','month','type','groupName','description','account','costType','value','verticalAnalysis')),
      jsonb_build_object('name','despesas','capability','dashboard.read','dateField','date','description','Despesas detalhadas por competência, categoria e classificação DRE.','fields',jsonb_build_array('unitName','month','date','description','category','dreClassification','expenseType','value')),
      jsonb_build_object('name','compras_pedidos','capability','operation.read','dateField','orderDate','description','Pedidos de compra e seus valores e estados.','fields',jsonb_build_array('unitName','number','supplier','status','orderDate','expectedDate','totalValue','requester')),
      jsonb_build_object('name','compras_notas','capability','operation.read','dateField','issueDate','description','Notas fiscais de compras por fornecedor.','fields',jsonb_build_array('unitName','invoiceNumber','issueDate','supplier','cfop','source','status','referenceMonth','totalValue')),
      jsonb_build_object('name','manutencao','capability','operation.read','dateField','requestedDate','description','Chamados de manutenção, prioridade, status e valor previsto.','fields',jsonb_build_array('unitName','operation','category','location','floor','priority','service','reason','requestedDate','executionDate','executor','status','expectedValue')),
      jsonb_build_object('name','pessoas','capability','people.read','dateField','admissionDate','description','Quadro operacional sem CPF, documentos, endereço, contatos, salário ou dados bancários.','fields',jsonb_build_array('unitName','displayName','role','department','active','admissionDate','dismissalDate','hrStatus','score','employmentType')),
      jsonb_build_object('name','ausencias','capability','people.read','dateField','date','description','Ausências por colaborador, tipo e impacto operacional, sem anexos médicos.','fields',jsonb_build_array('unitName','employeeName','date','type','reason','scoreImpact')),
      jsonb_build_object('name','planos_acao','capability','operation.read','dateField','deadline','description','Planos de ação operacionais e seus estados.','fields',jsonb_build_array('unitName','title','description','origin','status','deadline','createdAt','updatedAt')),
      jsonb_build_object('name','pedidos_venda','capability','dashboard.read','dateField','orderedAt','description','Pedidos de venda do Atena com pessoas, itens, taxas, descontos e total.','fields',jsonb_build_array('unitName','type','status','orderedAt','people','itemsValue','feesValue','discountValue','totalValue'))
    ),
    'rules', jsonb_build_array(
      'Consultas são somente leitura e limitadas às casas autorizadas.',
      'Datas usam YYYY-MM-DD; períodos não têm o antigo limite de 93 dias.',
      'Use grain month em períodos longos do dataset financeiro.',
      'search filtra nomes ou descrições; unit filtra pelo nome da casa, marca ou grupo.',
      'Cada consulta retorna no máximo 200 linhas; refine os filtros se necessário.'
    )
  );
end
$$;
