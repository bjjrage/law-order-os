import {schemaSql,constraintsSql} from '../../dist/os-app/packages/persistence-postgres/src/schema.js';
import {readdirSync,writeFileSync} from 'node:fs';
const filenames=readdirSync('supabase/migrations').filter(p=>p.endsWith('_os_core_local.sql'));
if(filenames.length!==1)throw Error('EXPECTED_ONE_CLI_CREATED_MIGRATION');
writeFileSync('supabase/migrations/'+filenames[0],'-- LOCAL DEVELOPMENT ONLY. Generated from packages/persistence-postgres/src/schema.ts.\n'+schemaSql+constraintsSql);
console.log(JSON.stringify({migration:filenames[0],remote_applied:false}));
