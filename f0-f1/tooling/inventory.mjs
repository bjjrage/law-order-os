import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(fs.readFileSync('f0-f1/reports/baseline.json','utf8')).files;
const output='f0-f1/reports/delivery-inventory.json';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['node_modules','.git','.npm-cache'].includes(e.name)||e.isSymbolicLink())return [];
 const p=path.join(dir,e.name).replaceAll('\\','/');return e.isDirectory()?walk(p):[p];
});}
const files=walk('.').map(p=>p.replace(/^\.\//,'')).filter(p=>!Object.hasOwn(baseline,p)&&p!==output).sort().map(p=>({path:p,bytes:fs.statSync(p).size,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
fs.writeFileSync(output,JSON.stringify({created_at:new Date().toISOString(),scope:'New files only; this inventory excludes itself to avoid self-reference.',existing_files_modified:0,files},null,2));
console.log(JSON.stringify({new_files:files.length,root_reports:files.filter(f=>!f.path.includes('/')&&f.path.endsWith('.md')).length,canonical_installed:files.filter(f=>f.path.startsWith('docs/')).length}));
