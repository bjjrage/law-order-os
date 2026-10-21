import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
const execute=promisify(execFile),cache=new Map();
export async function libraryProcessRunning(pid,script){
  if(!Number.isSafeInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);}catch(error){return error.code==='EPERM';}
  const key=pid+':'+script,prior=cache.get(key);if(prior&&Date.now()-prior.at<30000)return prior.running;
  try{
    const command=process.platform==='win32'
      ?(await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}';if($p){$p.CommandLine}`],{windowsHide:true,timeout:5000,maxBuffer:32768})).stdout
      :await readFile(`/proc/${pid}/cmdline`,'utf8');
    const running=command.replace(/\\/g,'/').includes('scripts/'+script);
    cache.set(key,{at:Date.now(),running});return running;
  }catch{return true;} // Unknown identity must never start a duplicate worker.
}
