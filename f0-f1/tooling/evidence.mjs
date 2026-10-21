import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(['node_modules','.git','.npm-cache','f0-f1'].includes(e.name)) return [];
  const p=path.join(dir,e.name); if(e.isSymbolicLink()) return [];
  return e.isDirectory()?walk(p):[p];
});
fs.mkdirSync('f0-f1/reports',{recursive:true});
const mode=process.argv[2];
if(mode==='baseline'){
 const files=Object.fromEntries(walk(root).map(p=>[path.relative(root,p).replaceAll('\\','/'),hash(p)]));
 fs.writeFileSync('f0-f1/reports/baseline.json',JSON.stringify({captured_at:new Date().toISOString(),excluded:['node_modules','.git','.npm-cache','f0-f1'],files},null,2),{flag:'wx'});
 console.log(JSON.stringify({preserved_files:Object.keys(files).length}));
}else if(mode==='verify'){
 const baseline=JSON.parse(fs.readFileSync('f0-f1/reports/baseline.json','utf8'));
 const changed=Object.entries(baseline.files).filter(([p,h])=>!fs.existsSync(p)||hash(p)!==h).map(([p])=>p);
 const manifest=JSON.parse(fs.readFileSync('docs/DOCUMENT_MANIFEST_SHA256.json','utf8'));
 const canonical=Object.entries(manifest.files).map(([p,h])=>({path:p,expected:h,actual:hash(p==='README_PRIMERO.md'?'LAW_ORDER_OS_BLUEPRINT_ROADMAP_CANONICO_V2/README_PRIMERO.md':p)}));
 const self=canonical.filter(e=>e.path==='docs/DOCUMENT_MANIFEST_SHA256.json'&&e.expected!==e.actual);
 const unexpected=canonical.filter(e=>e.path!=='docs/DOCUMENT_MANIFEST_SHA256.json'&&e.expected!==e.actual);
 const tests=JSON.parse(fs.readFileSync('f0-f1/reports/vitest.json','utf8'));
 const os=tests.testResults.filter(e=>e.name.replaceAll('\\','/').includes('/os-core/tests/'));
 const deliverables=['DOCS_RECONCILIATION_REPORT','OS_CURRENT_STATE_AUDIT','ADR_OS_001_DECISION_PROPOSAL','OS_CORE_IMPLEMENTATION_PLAN','OS_CORE_DATA_API_CONTRACTS','UI_COMPACT_DESIGN_SPEC','OS_CORE_E2E_ACCEPTANCE','ROADMAP_STATUS_RECONCILED','BLOCKERS_AND_DECISIONS','NEXT_EXECUTION_HANDOFF'];
 const missing=deliverables.filter(p=>!fs.existsSync(p+'.md'));
 const roadmap=fs.readFileSync('docs/LAW_ORDER_OS_ROADMAP_v2.0.md','utf8');
 const ids=[...roadmap.matchAll(/\*\*(F\d+-T\d+)\*\*/g)].map(m=>m[1]);
 const matrix=JSON.parse(fs.readFileSync('f0-f1/reports/roadmap-matrix.json','utf8'));
 const missingIds=ids.filter(id=>!matrix.some(row=>row.id===id));
 const result={checked_at:new Date().toISOString(),baseline_files:Object.keys(baseline.files).length,changed_existing_files:changed,canonical,manifest_self_mismatch:self.length,unexpected_canonical_mismatches:unexpected.length,tests:{success:tests.success,total:tests.numTotalTests,passed:tests.numPassedTests,files:tests.testResults.length,os_core:os.reduce((n,e)=>n+e.assertionResults.length,0)},missing_deliverables:missing,roadmap:{canonical_tasks:ids.length,matrix_rows:matrix.length,missing_ids:missingIds},paid_calls:0,deployments:0};
 fs.writeFileSync('f0-f1/reports/final-verification.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,canonical:undefined},null,2));
 if(changed.length||unexpected.length||missing.length||missingIds.length||ids.length!==matrix.length||!tests.success)process.exitCode=1;
}else throw Error('Use baseline or verify');
