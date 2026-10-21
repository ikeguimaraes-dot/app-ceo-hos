-- Auditoria de metadados. Não consulta linhas de negócio e não modifica o banco.
-- Executar apenas após autorização específica para o ambiente.
-- Não incluir resultados privados em commits ou exportações públicas.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Tabelas e views públicas: isolamento e acesso efetivo das roles do cliente.
SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r','p','v','m')
ORDER BY 1,2;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public','storage')
ORDER BY schemaname,tablename,policyname;

-- Funções expostas: privilégios, sem exportar corpo de funções potencialmente sensível.
SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','storage') ORDER BY 1,2,3;

-- Estrutura dos objetos de identidade e notificações, sem listar usuários/dispositivos.
SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('groups','brands','units','roles','user_roles','profiles','notifications')
ORDER BY table_name,ordinal_position;

-- Definições de constraints de identidade, não seus valores.
SELECT n.nspname, c.relname, con.conname, con.contype,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('groups','brands','units','roles','user_roles','profiles','notifications')
ORDER BY 1,2,3;
ROLLBACK;
