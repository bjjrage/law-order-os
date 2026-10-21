import fs from 'node:fs';
const root='local-browser/reports/ink-buttons';
const index=fs.readFileSync('dist/web/index.html','utf8');
const css=index.match(/href="([^"]+\.css)"/)?.[1];
if(!css)throw Error('Built CSS not found');
const samples=[
 ['secondary','Agenda / acción secundaria','<button data-case="secondary">Crear tarea en un asunto →</button>'],
 ['primary','Formulario / primario','<div class="form-footer"><button class="primary" data-case="primary">Guardar</button></div>'],
 ['text','Acción discreta','<button class="text-action" data-case="text">Descargar original</button>'],
 ['danger','Documentos / papelera','<div class="document-file-actions"><button class="text-action document-remove" data-case="danger">Eliminar ejemplo</button></div>'],
 ['segmented','Clientes / filtro','<div class="segmented"><button aria-pressed="true" data-case="segmented">Personas</button></div>'],
 ['agenda','Agenda / filtro','<div class="agenda-filters"><button aria-pressed="true" data-case="agenda">Próximas <strong>1</strong></button></div>'],
 ['summary','Clientes / KPI','<div class="summary-strip"><button class="summary-control" aria-pressed="true" data-case="summary"><span>Clientes con asuntos abiertos</span><strong>3</strong><small>Filtrar clientes →</small></button></div>'],
 ['dashboard','Dashboard / KPI','<div class="dashboard-kpis"><button aria-pressed="true" data-case="dashboard"><span>Mis tareas para hoy</span><strong>2</strong><small>Pendientes</small></button></div>'],
 ['row','Dashboard / fila','<div class="dashboard-matters"><button data-case="row"><span><strong>Revisar contrato</strong><small>Cliente de prueba</small></span></button></div>'],
 ['tab','Asunto / pestaña','<div class="tabs"><button role="tab" aria-selected="true" data-case="tab">Documentos</button></div>'],
 ['result-tab','Equipo / resultado','<div class="result-tabs"><button role="tab" aria-selected="true" data-case="result-tab">Integración</button></div>'],
 ['library','Biblioteca / selector','<div class="legal-library"><div class="actions"><button aria-pressed="true" data-case="library">Documentos</button></div></div>'],
 ['favorite','Biblioteca / favorito','<button aria-pressed="true" aria-label="Favorito de prueba" data-case="favorite">★</button>'],
 ['specialist','Equipo / especialista','<div class="specialist-selector"><button aria-pressed="true" data-case="specialist"><span><strong>Elena</strong><small>Contratos</small></span></button></div>'],
 ['legacy','Piloto / primario','<div class="contractual-pilot"><button class="primary" data-case="legacy">Confirmar ejemplo</button></div>'],
 ['sidebar','Sidebar / respaldo','<div class="sidebar"><div class="local-tools"><button data-case="sidebar">Exportar respaldo</button></div></div>'],
 ['nav','Sidebar / navegación','<div class="sidebar"><button class="nav-item active" data-case="nav">Asuntos</button></div>'],
 ['file','Importar / etiqueta','<label class="button" data-case="file">Adjuntar ejemplo<input class="sr-only" type="file" aria-label="Archivo de prueba"></label>'],
 ['link','Enlace con apariencia de botón','<a class="button" href="#check" data-case="link">Volver al inicio</a>'],
 ['disabled','Deshabilitado y seleccionado','<button class="primary" disabled aria-pressed="true" data-case="disabled">No disponible</button>'],
 ['busy','En proceso','<button class="primary" disabled aria-busy="true" data-case="busy">Guardando…</button>'],
 ['recovery','Recuperación / primario','<div class="recovery-screen"><button class="primary" data-case="recovery">Recargar el OS</button></div>'],
];
const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Verificación de botones · CSS real del OS</title><link rel="stylesheet" href="'+css+'"><link rel="stylesheet" href="/ink-button-check.css"></head><body><main id="check" class="shell"><h1>Verificación del CSS compilado</h1><p>Controles de prueba sin operaciones. La transición de color se desactiva aquí para medir cada estado; el OS conserva sus 140 ms.</p><div class="check-grid">'+samples.map(([id,title,markup])=>'<section class="sample"><p>'+title+'</p><div class="sample-context">'+markup+'</div></section>').join('')+'</div></main></body></html>';
const helper='#check{display:block;min-height:0;padding:20px;max-width:1366px;margin:auto}#check>h1{font-size:24px;margin-bottom:8px}#check>p{margin-bottom:16px}.check-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sample{padding:12px;border:1px solid #d9ded9;background:#fffefa;border-radius:7px;min-width:0}.sample>p{font-size:10px;font-weight:650;margin-bottom:9px}.sample-context{min-height:40px}#check :is(button,.button){transition-duration:0s}#check .sidebar{position:static;min-height:0;height:auto;width:auto;padding:8px}#check .local-tools{padding:0}#check .form-footer{margin:0;padding:0;border:0}#check :is(.summary-strip,.dashboard-kpis,.specialist-selector){display:block;margin:0;padding:0}#check .summary-control{width:100%}#check .tabs{margin:0}#check .recovery-screen{display:block;min-height:0;padding:0}#check .dashboard-matters{margin:0;padding:0}#check .legal-library>.actions{padding:0}';
fs.writeFileSync(root+'/check.html',html);
fs.writeFileSync('dist/web/ink-button-check.html',html);
fs.writeFileSync('dist/web/ink-button-check.css',helper);
fs.writeFileSync(root+'/check.css',helper);
console.log(JSON.stringify({css,samples:samples.length,url:'http://127.0.0.1:4313/ink-button-check.html'}));
