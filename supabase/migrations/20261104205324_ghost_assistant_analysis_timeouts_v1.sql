-- Only the two bounded executive queries may wait for the authenticated
-- events source beyond the default 8s. All other KPH role/query limits stay as-is.
alter function public.ghost_assistant_finance_analysis_v1(date,date,text,text,boolean,integer) set statement_timeout='30s';
alter function public.ghost_assistant_compare_v1(text,date,date,date,date,text,text,boolean) set statement_timeout='30s';
notify pgrst,'reload schema';
