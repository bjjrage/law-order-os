import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Invoke JS entry points directly: Windows npm .cmd shims mishandle paths containing &.
const cwd=fileURLToPath(new URL('../',import.meta.url));
const built=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.build.json'],{cwd,stdio:'inherit',shell:false,windowsHide:true});
if(built.error || built.status!==0){process.exitCode=built.status??1;}
else{
  const child=spawn(process.execPath,['dist/cli/index.js',...process.argv.slice(2)],{cwd,stdio:'inherit',shell:false,windowsHide:true});
  child.once('error',()=>{process.stderr.write('CLI_PROCESS_FAILED\n');process.exitCode=1;});
  child.once('exit',(code)=>{process.exitCode=code??1;});
}
