// Apply missing constraints only to this task's portable, empty application database.
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {constraintsSql} from '../../dist/os-app/packages/persistence-postgres/src/schema.js';
const passwords=JSON.parse(readFileSync('.local-dev/postgres-secrets.json','utf8'));
const pool=new Pool({host:'127.0.0.1',port:55432,user:'postgres',password:passwords.admin,database:'law_order_local'});
try{if(!(await pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema='os_private' AND table_name='approvals'")).rowCount){
 await pool.query('BEGIN');try{await pool.query(constraintsSql);await pool.query('COMMIT');}catch(e){await pool.query('ROLLBACK');throw e;}
 }
 const policies=constraintsSql.slice(constraintsSql.indexOf('DROP POLICY update ON os_private.drafts'),constraintsSql.indexOf('CREATE FUNCTION os_private.review_only_changes'));
 await pool.query(policies);
 console.log('Esquema local comprobado; ningún proyecto remoto.');}finally{await pool.end();}
