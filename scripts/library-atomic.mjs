import {open,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
let serial=0;
export async function atomicLibraryFile(path,bytes,{renameFile=rename,wait=delay}={}){
  const temp=path+'.'+process.pid+'-'+serial+++'-'+randomUUID()+'.next';
  try{const file=await open(temp,'wx');try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}for(let attempt=0;;attempt++)try{await renameFile(temp,path);return;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt>=19)throw e;await wait(Math.min(200,20*(attempt+1)));}}
  finally{await unlink(temp).catch(()=>{});}
}
export const atomicLibraryJson=(path,value,options)=>atomicLibraryFile(path,JSON.stringify(value),options);
