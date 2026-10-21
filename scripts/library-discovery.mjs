import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sha} from './library-corpus-store.mjs';
import {officialGet,bacnRecords,presidencyRecords,mefRecords,clean,decode} from './library-corpus-ingest.mjs';
import {officialUrl} from './library-research.mjs';
import {atomicLibraryFile,atomicLibraryJson} from './library-atomic.mjs';
export function acordadaRecords(html){
  const rows=[];
  for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>clean(c[1]));
    const href=/href="([^"]+\.pdf)"/i.exec(m[1])?.[1];if(!href||cells.length<3||!/^\d+$/.test(cells[0]))continue;
    const url=officialUrl(new URL(decode(href),'https://www.pj.gov.py').href);if(!url)continue;
    const date=/data-order="(\d{4}-\d{2}-\d{2})"/.exec(m[1])?.[1]??'';
    rows.push({id:'csj-acordada-'+sha(url).slice(0,20),type:'Acordada',number:cells[0],year:date.slice(0,4),date,title:'Acordada '+cells[0]+' · '+cells[2],url,source:'Corte Suprema de Justicia',source_url:'https://www.pj.gov.py/nominas/acordadas-digitales',text_indexed:false,notes:'Publicación institucional; cotejar vigencia y modificaciones.'});
  }return rows;
}
export function csjRecords(html,year){
  const rows=[];
  for(const m of html.matchAll(/<div class="list-item box" id="(\d+)">([\s\S]*?)(?=<div class="list-item box"|<script|$)/g)){
    const title=clean(/<p class="title">([\s\S]*?)<\/p>/.exec(m[2])?.[1]??''),desc=clean(/<p class="desc">([\s\S]*?)<\/p>/.exec(m[2])?.[1]??'');
    const type=/^Decreto\s+Ley/i.test(title)?'Decreto Ley':/^Decreto/i.test(title)?'Decreto':/^Ley/i.test(title)?'Ley':/^Resoluci/i.test(title)?'Resolución':/^Constituci/i.test(title)?'Constitución':null;
    if(!type)continue;
    rows.push({id:'csj-norma-'+m[1],type,title:title+' · '+desc,number:/\d+/.exec(title)?.[0]??'',year:String(year),date:'',url:'https://www.csj.gov.py/legislacion/Consulta/Detalle?id='+m[1],source:'Corte Suprema de Justicia · Legislación',source_url:'https://www.csj.gov.py/legislacion',source_status:'DETAIL_PAGE',notes:'Registro y documentos enlazados en publicación oficial; verificar relaciones normativas.',text_indexed:false});
  }return rows;
}
export function judicialRecords(data){
  if(!Array.isArray(data.data)||!Number.isSafeInteger(data.recordsFiltered))throw Error('JUDICIAL_RESPONSE_INVALID');
  return data.data.filter(r=>Number.isSafeInteger(r.CodigoJurisprudencia)).map(r=>{
    const ms=/\/Date\((\d+)\)\//.exec(r.FechaResolucionJudicial??'')?.[1];const date=ms?new Date(Number(ms)).toISOString().slice(0,10):'';
    const number=String(r.NoResolucionJudicial??''),type=r.TipoResolucionJudicial?.DescripcionTipoResolucionJudicial??'Resolución judicial';
    return {id:'csj-juris-'+r.CodigoJurisprudencia,type:'Jurisprudencia',number,year:date.slice(0,4),date,title:`${type} ${number} · ${r.Sala?.DescripcionSala??''} · ${date} · ${r.CaratulaPublicacion??''}`,url:'https://www.csj.gov.py/jurisprudencia/home/DocumentoJurisprudencia?codigo='+r.CodigoJurisprudencia,source:'Corte Suprema de Justicia · Jurisprudencia',source_url:'https://www.csj.gov.py/jurisprudencia/home/detalle?codigo='+r.CodigoJurisprudencia,source_status:r.TieneDocumento?'ORIGINAL_LINKED':'ORIGINAL_UNAVAILABLE',text_indexed:false,notes:'Registro judicial oficial; identidad, alcance y versión sujetos a cotejo.'};
  });
}
export function judicialYears(html){
  const select=[...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)].find(m=>/\bid=["']Anno["']/.test(m[0]))?.[0]??'';
  const years=[...select.matchAll(/<option\b[^>]*value=["'](\d{4})["']/gi)].map(m=>Number(m[1])).filter(y=>y>=1800&&y<=new Date().getUTCFullYear());
  if(!years.length)throw Error('JUDICIAL_YEARS_UNAVAILABLE');return [...new Set(years)].sort((a,b)=>b-a);
}
export async function discoverAll({root,db,onProgress=()=>{},publish=async()=>{}}){
  const dir=resolve(root,'local-browser/library/research/discovery');await mkdir(dir,{recursive:true});
  const get=async(url)=>{
    const file=resolve(dir,sha(url)+'.raw');let bytes=await readFile(file).catch(()=>null);
    if(!bytes){bytes=(await officialGet(url,{maxBytes:12_000_000})).bytes;await atomicLibraryFile(file,bytes);}
    return bytes.toString('utf8');
  };
  const job=async(name,run)=>{
    const state=db.state('discover:'+name)??{next:0,complete:false,records:0};
    if(name==='CSJ_JURISPRUDENCIA'&&state.complete&&!state.available_years)state.complete=false;
    if(state.complete)return;
    try{await run(state);}
    catch(e){state.error=e.message;state.failed_at=new Date().toISOString();db.state('discover:'+name,state);onProgress({source:name,status:'SOURCE_UNAVAILABLE',error:e.message});}
  };
  // Parallel discovery only; downloads and OCR remain serial and use one OCR worker.
  await Promise.all([
    job('BACN',async s=>{
      for(let page=Math.max(1,s.next);page<=2000;page++){
        const html=await get(`https://www.bacn.gov.py/paginacion/leyes-paraguayas.php?action=ajax&page=${page}`),rows=bacnRecords(html);
        const maximum=Math.max(...[...html.matchAll(/load\((\d+)\)/g)].map(m=>Number(m[1])),page);
        db.register(rows);s.next=page+1;s.records+=rows.length;s.total_pages=maximum;s.complete=!rows.length||page>=maximum;db.state('discover:BACN',s);
        onProgress({source:'BACN',page,total:maximum,records:s.records});if(page%25===0)await publish();if(s.complete)break;
      }
    }),
    job('PRESIDENCIA',async s=>{
      for(let page=s.next;page<2000;page++){
        const params=new URLSearchParams({page:String(page),pageSize:'100',sortAsc:'false',sortField:'fechaPromulgacion',nroNorma:'',tipoDocumento:'DECRETOS',acapite:'',fechaElaboracion:'',fechaPromulgacionDesde:'',fechaPromulgacionHasta:'',derogado:'',presidente:'',oee:'',etiqueta:''});
        const data=JSON.parse(await get('https://decretos.presidencia.gov.py/api/norma/?'+params));
        // A malformed legacy entry cannot discard an otherwise valid page.
        let rows=[];for(const row of data.data?.lista??[])try{rows.push(...presidencyRecords({code:data.code,data:{lista:[row],totalRecords:data.data.totalRecords}}));}catch{ s.invalid_records=(s.invalid_records??0)+1; }
        if(data.code!==200||!Array.isArray(data.data?.lista))throw Error('INVALID_PRESIDENCY_PAGE');
        db.register(rows);s.next=page+1;s.records+=rows.length;s.total_records=data.data.totalRecords;s.complete=(page+1)*100>=s.total_records||!data.data.lista.length;db.state('discover:PRESIDENCIA',s);
        onProgress({source:'PRESIDENCIA',page:page+1,total:Math.ceil(s.total_records/100),records:s.records});if(page%25===0)await publish();if(s.complete)break;
      }
    }),
    job('MEF',async s=>{
      for(let page=s.next;page<500;page++){
        const rows=mefRecords(await get('https://www.mef.gov.py/es/marco-legal/decretos?page='+page));db.register(rows);s.next=page+1;s.records+=rows.length;s.complete=!rows.length;db.state('discover:MEF',s);onProgress({source:'MEF',page,records:s.records});if(s.complete)break;
      }
    }),
    job('ACORDADAS',async s=>{
      const rows=acordadaRecords(await get('https://www.pj.gov.py/nominas/acordadas-digitales'));if(!rows.length)throw Error('ACORDADAS_BODY_UNAVAILABLE');db.register(rows);s.records=rows.length;s.complete=true;db.state('discover:ACORDADAS',s);onProgress({source:'ACORDADAS',records:rows.length});
    }),
    job('CSJ_LEGISLACION',async s=>{
      for(let year=s.next||new Date().getUTCFullYear();year>=1869;year--){
        const file=resolve(dir,'csj-year-'+year+'.html');let html=await readFile(file,'utf8').catch(()=>null);
        if(!html){
          const body=new URLSearchParams({DescripcionLegislacion:'',AnnoGaceta:String(year),Numero:'',Fuentes:'[]',Materias:'[]',Temas:'[]',Instituciones:'[]',BusquedaEnTexto:'false'});
          const r=await fetch('https://www.csj.gov.py/legislacion/Consulta/Resultado',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(30000)});
          if(!r.ok)throw Error('CSJ_LIST_HTTP_'+r.status);html=await r.text();if(html.length>20_000_000)throw Error('CSJ_LIST_TOO_LARGE');await atomicLibraryFile(file,html);
        }
        const rows=csjRecords(html,year);db.register(rows);s.next=year-1;s.records+=rows.length;s.complete=year===1869;db.state('discover:CSJ_LEGISLACION',s);onProgress({source:'CSJ_LEGISLACION',year,records:s.records});if(year%10===0)await publish();
      }
    }),
    job('CSJ_JURISPRUDENCIA',async s=>{
      const cookies=new Map();
      const remember=r=>r.headers.getSetCookie().forEach(c=>{const p=c.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));});
      const headers=()=>({'Content-Type':'application/x-www-form-urlencoded',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')});
      let minimumYear=null;
      for(let year=s.year??new Date().getUTCFullYear();minimumYear===null||year>=minimumYear;year--){
        const response=await fetch('https://www.csj.gov.py/jurisprudencia/Home/Criterios',{signal:AbortSignal.timeout(25000)});remember(response);
        if(!response.ok)throw Error('JUDICIAL_CRITERIA_UNAVAILABLE');
        const html=await response.text(),token=/name="__RequestVerificationToken"[^>]*value="([^"]+)"/.exec(html)?.[1];if(!token)throw Error('PUBLIC_SEARCH_FORM_UNAVAILABLE');
        if(minimumYear===null){s.available_years=judicialYears(html);minimumYear=Math.min(...s.available_years);if(year<minimumYear)break;}
        const search=await fetch('https://www.csj.gov.py/jurisprudencia/Home/Busqueda',{method:'POST',redirect:'error',headers:headers(),body:new URLSearchParams({__RequestVerificationToken:token,Anno:String(year),PalabrasTexto:'',Numero:'',RangoFecha:'',TipoResolucion:''}),signal:AbortSignal.timeout(30000)});remember(search);if(!search.ok)throw Error('JUDICIAL_SEARCH_HTTP_'+search.status);await search.text();
        for(let offset=s.year===year?s.offset??0:0;;offset+=100){
          const file=resolve(dir,`csj-juris-${year}-${offset}.json`);let data=JSON.parse(await readFile(file,'utf8').catch(()=>'null'));
          if(!data){const r=await fetch('https://www.csj.gov.py/jurisprudencia/Jurisprudencias/GetData',{method:'POST',redirect:'error',headers:headers(),body:new URLSearchParams({draw:'1',start:String(offset),length:'100','search[value]':'','order[0][column]':'0','order[0][dir]':'asc'}),signal:AbortSignal.timeout(30000)});remember(r);if(!r.ok)throw Error('JUDICIAL_LIST_HTTP_'+r.status);data=await r.json();await atomicLibraryJson(file,data);}
          const rows=judicialRecords(data);db.register(rows);s.year=year;s.offset=offset+100;s.records+=rows.length;db.state('discover:CSJ_JURISPRUDENCIA',s);onProgress({source:'CSJ_JURISPRUDENCIA',year,records:s.records,total_year:data.recordsFiltered,offset});if(offset%2500===0)await publish();
          if(offset+100>=data.recordsFiltered||!data.data.length)break;
        }
        s.year=year-1;s.offset=0;db.state('discover:CSJ_JURISPRUDENCIA',s);
      }
      s.complete=true;db.state('discover:CSJ_JURISPRUDENCIA',s);
    }),
  ]);
  await publish();
}
