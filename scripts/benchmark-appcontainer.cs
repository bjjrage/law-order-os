// Windows kernel isolation for a single frozen benchmark capsule. No capabilities,
// no loopback exemption, no inherited environment, and no writable host directory.
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;

public static class LawBenchmarkContainer {
  [StructLayout(LayoutKind.Sequential)] struct SA { public int n; public IntPtr d; public int inherit; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct SI {
    public int cb; public string reserved, desktop, title;
    public int x,y,xs,ys,xc,yc,fill,flags; public short show,cb2;
    public IntPtr reserved2, stdin, stdout, stderr;
  }
  [StructLayout(LayoutKind.Sequential)] struct SIX { public SI si; public IntPtr attributes; }
  [StructLayout(LayoutKind.Sequential)] struct PI { public IntPtr process, thread; public uint pid, tid; }
  [StructLayout(LayoutKind.Sequential)] struct CAPS { public IntPtr sid, caps; public int count, reserved; }
  [StructLayout(LayoutKind.Sequential)] struct BASICLIMIT {
    public long processTime,jobTime; public uint flags; public UIntPtr min,max;
    public uint active; public UIntPtr affinity; public uint priority,scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct IOCOUNTERS { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct LIMIT {
    public BASICLIMIT basic; public IOCOUNTERS io; public UIntPtr process,job,peakProcess,peakJob;
  }
  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] static extern int CreateAppContainerProfile(string name,string display,string description,IntPtr caps,uint count,out IntPtr sid);
  [DllImport("userenv.dll", CharSet=CharSet.Unicode)] static extern int DeleteAppContainerProfile(string name);
  [DllImport("advapi32.dll")] static extern IntPtr FreeSid(IntPtr sid);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr info,int size,out int needed);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr key,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool CreateProcessW(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SIX startup,out PI info);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref SA sa,uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr handle,uint code);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr sa,string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref LIMIT limit,int size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  static void Check(bool ok,string operation) { if(!ok) throw new InvalidOperationException(operation+"_WIN32_"+Marshal.GetLastWin32Error()); }
  public static int Run(string capsule) {
    if(!Directory.Exists(capsule) || !File.Exists(Path.Combine(capsule,"capsule.json"))) throw new InvalidOperationException("BENCHMARK_CAPSULE_REQUIRED");
    string profile="law-order-benchmark-"+Guid.NewGuid().ToString("N");
    IntPtr sid=IntPtr.Zero, list=IntPtr.Zero, cp=IntPtr.Zero, hp=IntPtr.Zero, env=IntPtr.Zero, job=IntPtr.Zero;
    IntPtr inputRead=IntPtr.Zero,inputWrite=IntPtr.Zero,outputRead=IntPtr.Zero,outputWrite=IntPtr.Zero;
    PI pi=new PI(); FileSystemAccessRule rule=null;
    try {
      int hr=CreateAppContainerProfile(profile,profile,"Offline legal benchmark",IntPtr.Zero,0,out sid);
      if(hr!=0) Marshal.ThrowExceptionForHR(hr);
      var sidObject=new SecurityIdentifier(sid);
      rule=new FileSystemAccessRule(sidObject,FileSystemRights.ReadAndExecute,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow);
      var dir=new DirectoryInfo(capsule); var acl=dir.GetAccessControl(); acl.AddAccessRule(rule); dir.SetAccessControl(acl);
      var sa=new SA { n=Marshal.SizeOf(typeof(SA)), inherit=1 };
      Check(CreatePipe(out inputRead,out inputWrite,ref sa,0),"STDIN_PIPE");
      Check(CreatePipe(out outputRead,out outputWrite,ref sa,0),"STDOUT_PIPE");
      Check(SetHandleInformation(inputWrite,1,0),"STDIN_INHERIT");
      Check(SetHandleInformation(outputRead,1,0),"STDOUT_INHERIT");
      IntPtr size=IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
      list=Marshal.AllocHGlobal(size); Check(InitializeProcThreadAttributeList(list,2,0,ref size),"ATTRIBUTES");
      var caps=new CAPS { sid=sid }; cp=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(CAPS))); Marshal.StructureToPtr(caps,cp,false);
      Check(UpdateProcThreadAttribute(list,0,(IntPtr)0x20009,cp,(IntPtr)Marshal.SizeOf(typeof(CAPS)),IntPtr.Zero,IntPtr.Zero),"CAPABILITIES");
      hp=Marshal.AllocHGlobal(2*IntPtr.Size);Marshal.WriteIntPtr(hp,0,inputRead);Marshal.WriteIntPtr(hp,IntPtr.Size,outputWrite);
      Check(UpdateProcThreadAttribute(list,0,(IntPtr)0x20002,hp,(IntPtr)(2*IntPtr.Size),IntPtr.Zero,IntPtr.Zero),"INHERITED_HANDLES");
      // Never inherit NODE_OPTIONS, API credentials, proxy settings, or DB URLs.
      var variables=new System.Collections.Generic.SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
      foreach(var name in new[]{"SystemRoot","WINDIR","USERPROFILE","LOCALAPPDATA","APPDATA","TEMP","TMP"}) {
        var v=Environment.GetEnvironmentVariable(name);if(v!=null)variables[name]=v;
      }
      variables["NODE_NO_WARNINGS"]="1";
      var environment=new StringBuilder();foreach(var v in variables)environment.Append(v.Key+"="+v.Value+"\0");environment.Append('\0');
      env=Marshal.StringToHGlobalUni(environment.ToString());
      var startup=new SIX { si=new SI { cb=Marshal.SizeOf(typeof(SIX)), flags=0x100, stdin=inputRead,stdout=outputWrite,stderr=outputWrite }, attributes=list };
      string node=Path.Combine(capsule,"node.exe");
      var cmd=new StringBuilder("\""+node+"\" --preserve-symlinks --preserve-symlinks-main --permission --allow-fs-read=\""+capsule+"\" \""+Path.Combine(capsule,"scripts/benchmark-worker.mjs")+"\"");
      Check(CreateProcessW(node,cmd,IntPtr.Zero,IntPtr.Zero,true,0x80000|0x400|0x8000000|4,env,capsule,ref startup,out pi),"CREATE_CONTAINER");
      job=CreateJobObject(IntPtr.Zero,null); Check(job!=IntPtr.Zero,"CREATE_JOB");
      var limit=new LIMIT { basic=new BASICLIMIT { flags=0x2008, active=1 } };
      Check(SetInformationJobObject(job,9,ref limit,Marshal.SizeOf(typeof(LIMIT))),"JOB_LIMIT");
      Check(AssignProcessToJobObject(job,pi.process),"ASSIGN_JOB");
      IntPtr token; Check(OpenProcessToken(pi.process,8,out token),"OPEN_TOKEN");
      try {
        IntPtr tokenInfo=Marshal.AllocHGlobal(4096); int needed;
        try {
          Check(GetTokenInformation(token,29,tokenInfo,4096,out needed),"TOKEN_CONTAINER");
          if(Marshal.ReadInt32(tokenInfo)!=1)throw new InvalidOperationException("NOT_APPCONTAINER");
          Check(GetTokenInformation(token,30,tokenInfo,4096,out needed),"TOKEN_CAPABILITIES");
          if(Marshal.ReadInt32(tokenInfo)!=0)throw new InvalidOperationException("UNEXPECTED_CAPABILITIES");
        } finally { Marshal.FreeHGlobal(tokenInfo); }
      } finally { CloseHandle(token); }
      Console.WriteLine("{\"type\":\"isolation\",\"appContainer\":true,\"capabilityCount\":0}");Console.Out.Flush();
      CloseHandle(inputRead); inputRead=IntPtr.Zero; CloseHandle(outputWrite); outputWrite=IntPtr.Zero;
      using(var input=new FileStream(new SafeFileHandle(inputWrite,true),FileAccess.Write))
      using(var output=new FileStream(new SafeFileHandle(outputRead,true),FileAccess.Read)) {
        inputWrite=IntPtr.Zero; outputRead=IntPtr.Zero;
        Task.Run(()=>{try{var source=Console.OpenStandardInput();var buffer=new byte[8192];int n;while((n=source.Read(buffer,0,buffer.Length))>0){input.Write(buffer,0,n);input.Flush();}}catch{}});
        var drain=Task.Run(()=>{output.CopyTo(Console.OpenStandardOutput());});
        ResumeThread(pi.thread);
        if(WaitForSingleObject(pi.process,60000)!=0) { TerminateProcess(pi.process,124); throw new InvalidOperationException("BENCHMARK_TIMEOUT"); }
        drain.Wait(10000); uint code; GetExitCodeProcess(pi.process,out code); return (int)code;
      }
    } finally {
      if(pi.process!=IntPtr.Zero){TerminateProcess(pi.process,125);CloseHandle(pi.process);}
      if(pi.thread!=IntPtr.Zero)CloseHandle(pi.thread);
      if(job!=IntPtr.Zero)CloseHandle(job);
      foreach(var h in new[]{inputRead,inputWrite,outputRead,outputWrite})if(h!=IntPtr.Zero)CloseHandle(h);
      if(list!=IntPtr.Zero){DeleteProcThreadAttributeList(list);Marshal.FreeHGlobal(list);}
      if(cp!=IntPtr.Zero)Marshal.FreeHGlobal(cp); if(hp!=IntPtr.Zero)Marshal.FreeHGlobal(hp); if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);
      if(rule!=null){var d=new DirectoryInfo(capsule);var a=d.GetAccessControl();a.RemoveAccessRuleSpecific(rule);d.SetAccessControl(a);}
      if(sid!=IntPtr.Zero){FreeSid(sid);int hr=DeleteAppContainerProfile(profile);if(hr!=0)throw new InvalidOperationException("BENCHMARK_PROFILE_CLEANUP_FAILED_"+hr);}
    }
  }
}
