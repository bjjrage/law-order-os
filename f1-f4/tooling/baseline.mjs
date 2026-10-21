import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
fs.mkdirSync('f1-f4/reports',{recursive:true});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['node_modules','.git','.npm-cache','f1-f4'].includes(e.name)||e.isSymbolicLink())return [];
 const p=path.join(dir,e.name).replaceAll('\\','/');return e.isDirectory()?walk(p):[p];
});}
const files=walk('.').map(p=>p.replace(/^\.\//,'')).map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
fs.writeFileSync('f1-f4/reports/baseline.json',JSON.stringify({date:new Date().toISOString(),files},null,2),{flag:'wx'});
for(const dir of ['os-core/src','os-core/testing','os-core/tests']) fs.cpSync(dir,'f1-f4/baseline/'+dir,{recursive:true,errorOnExist:true});
for(const p of ['package.json','package-lock.json','tsconfig.json','.gitignore']) fs.copyFileSync(p,'f1-f4/baseline/'+p,fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify({files:files.length}));
