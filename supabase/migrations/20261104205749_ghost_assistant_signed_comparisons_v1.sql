-- Provide signed and presentation magnitudes together. A decline may be
-- written as "queda de X%" without asking the model to negate a financial value.
do $migration$
declare definition text; updated text;
begin
 definition:=pg_get_functiondef('public.ghost_assistant_compare_v1(text,date,date,date,date,text,text,boolean)'::regprocedure);
 updated:=replace(definition,'''difference'',av-bv,',
   '''difference'',av-bv,''absoluteDifference'',abs(av-bv),''changeDirection'',case when av>bv then ''increase'' when av<bv then ''decrease'' when av=bv then ''unchanged'' end,');
 if updated=definition then raise exception 'comparison_difference_shape_changed'; end if;
 definition:=updated;
 updated:=replace(definition,'''changePct'',case when bv<>0 then round(100*(av-bv)/abs(bv),2) end',
   '''changePct'',case when bv<>0 then round(100*(av-bv)/abs(bv),2) end,''absoluteChangePct'',case when bv<>0 then abs(round(100*(av-bv)/abs(bv),2)) end');
 if updated=definition then raise exception 'comparison_percentage_shape_changed'; end if;
 execute updated;
 definition:=pg_get_functiondef('ghost_private.assistant_finance_aggregate_v1(jsonb,jsonb,date,date,text,integer,numeric)'::regprocedure);
 updated:=replace(definition,'''difference'',revenue-goal,',
   '''difference'',revenue-goal,''absoluteDifference'',abs(revenue-goal),''goalPosition'',case when revenue>goal then ''above'' when revenue<goal then ''below'' when revenue=goal then ''equal'' end,');
 updated:=replace(updated,'''goalProgressPct'',case when goal>0 then round(100*revenue/goal,2) end,',
   '''goalProgressPct'',case when goal>0 then round(100*revenue/goal,2) end,''goalDeviationPct'',case when goal>0 then round(100*(revenue-goal)/goal,2) end,''absoluteGoalDeviationPct'',case when goal>0 then abs(round(100*(revenue-goal)/goal,2)) end,');
 if updated=definition then raise exception 'finance_goal_position_shape_changed'; end if;
 execute updated;
end $migration$;
notify pgrst,'reload schema';
