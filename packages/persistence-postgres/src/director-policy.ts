/** Reuses the existing private authorization function and its tenant boundary. */
export const directorAccessSql = `CREATE OR REPLACE FUNCTION os_private.permitted(firm text, matter text, permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_private AS $$
 SELECT os_private.member(firm,ARRAY['ADMINISTRATOR']) OR (
 os_private.member(firm) AND EXISTS(SELECT FROM os_private.participants p JOIN os_private.memberships m ON m.law_firm_id=p.law_firm_id AND m.data->>'identity_id'=p.data->>'identity_id'
 WHERE p.law_firm_id=firm AND p.matter_id=matter AND p.data->>'identity_id'=os_private.actor() AND (p.data->>'active')::boolean AND p.data->'permissions' ? permission
 AND (m.data->>'role' IN ('COORDINATOR','LAWYER') OR (m.data->>'role'='ASSISTANT' AND permission IN ('READ','DOCUMENT_WRITE','TASK_WRITE','DRAFT_WRITE')) OR (m.data->>'role'='ADMINISTRATION' AND permission='READ'))))
$$; REVOKE ALL ON FUNCTION os_private.permitted(text,text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION os_private.permitted(text,text,text) TO os_runtime;`;
