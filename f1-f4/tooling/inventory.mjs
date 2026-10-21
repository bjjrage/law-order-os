import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const baseline=new Set(JSON.parse(fs.readFileSync('f1-f4/reports/baseline.json','utf8')).files.map(f=>f.path));
const output='f1-f4/reports/new-files.json';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['node_modules','.git','.npm-cache','.local-dev','dist'].includes(e.name)||e.isSymbolicLink())return[];
 const p=path.join(dir,e.name).replaceAll('\\','/');return e.isDirectory()?walk(p):[p];
});
const files=walk('.').map(p=>p.replace(/^\.\//,'')).filter(p=>!baseline.has(p)&&p!==output).sort().map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
fs.writeFileSync(output,JSON.stringify({date:new Date().toISOString(),excludes:'This inventory itself, build output, local data, dependencies, caches and Git.',files},null,2));console.log(JSON.stringify({new_files:files.length}));
