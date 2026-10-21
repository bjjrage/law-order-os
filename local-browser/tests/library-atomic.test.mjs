import {expect,it,vi} from 'vitest';
import {mkdtemp,writeFile,readFile,rename,rm,readdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {atomicLibraryJson,atomicLibraryFile} from '../../scripts/library-atomic.mjs';
it('survives transient Windows rename locks while keeping the previous complete snapshot readable',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'law-order-atomic-'));try{
  const path=resolve(root,'progress.json');await writeFile(path,JSON.stringify({count:10}));let calls=0;
  const renameFile=vi.fn(async(a,b)=>{calls++;if(calls<3){expect(JSON.parse(await readFile(path,'utf8')).count).toBe(10);throw Object.assign(Error('temporary Windows lock'),{code:'EPERM'});}return rename(a,b);});
  await atomicLibraryJson(path,{count:20},{renameFile,wait:async()=>{}});expect(calls).toBe(3);expect(JSON.parse(await readFile(path,'utf8')).count).toBe(20);expect(await readdir(root)).toEqual(['progress.json']);
  const original=Buffer.from([0x25,0x50,0x44,0x46,0,255]);await atomicLibraryFile(resolve(root,'original.raw'),original);expect(await readFile(resolve(root,'original.raw'))).toEqual(original);
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep+'law-order-atomic-'))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}
});
