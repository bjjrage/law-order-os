import {writeFileSync} from 'node:fs';
const results=[];
for(const route of ['/health','/ready','/api/v1/session','/']){
 const response=await fetch('http://127.0.0.1:4310'+route,{signal:AbortSignal.timeout(5000),redirect:'error'});
 results.push({route,status:response.status,content_type:response.headers.get('content-type')});
}
const result={checked_at:new Date().toISOString(),host:'127.0.0.1:4310',results,real_login:'BLOCKED_LOCAL_SUPABASE',paid_calls:0,deployments:0};
writeFileSync('f1-f4/reports/running-application.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(results.find(r=>r.route==='/')?.status!==200||results.find(r=>r.route==='/api/v1/session')?.status!==401)process.exitCode=1;
