import {reportModel} from './reports/model.mjs';
import {exportReport} from './reports/export.mjs';
import {validateThroughStep} from './src/workflow.js';
import {loadSectorCatalog,catalogPaths} from './src/sectors.js';
import http from 'node:http';
import {readFile,appendFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {calculate} from './src/engine.js';
import {guideQuestion,safeHelp} from './assistant.mjs';
import {helpTopic} from './src/guidance.js';
const root=process.env.CBI_NETLIFY?process.cwd():path.dirname(fileURLToPath(import.meta.url));
let aiDay='',aiCalls=0,registry;
const catalogs=new Map();
const ready=(async()=>{
 if(!process.env.CBI_NETLIFY){try{const envText=await readFile(path.join(root,'.env'),'utf8');for(const line of envText.split(/\r?\n/)){const m=line.match(/^(GEMINI_API_KEY|GEMINI_MODEL|GEMINI_DAILY_REQUEST_LIMIT)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}}catch{}}
 const readCatalogJSON=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
 registry=await readCatalogJSON('data/sectors.json');
 for(const sector of registry.sectors.filter(s=>catalogPaths(registry).includes(s.catalogPath)))catalogs.set(sector.id,await loadSectorCatalog(registry,sector.id,readCatalogJSON));
})();
const storage=process.env.LEAD_STORAGE_DIR||path.join(root,'storage');
const port=Number(process.env.PORT||4173), host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const limits=new Map();
const timer=setInterval(()=>{for(const [key,b]of limits)if(Date.now()>b.expires)limits.delete(key);},60_000);timer.unref();
export const requestHandler=async(req,res)=>{
 await ready;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'self' https://www.cbitransport.com https://cbitransport.com; base-uri 'self'; form-action 'self'");
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return json(res,400,{error:'Geçersiz adres.'});}
 // Optional reverse proxy prefix: strip the configured mount path.
 const mount=process.env.BASE_PATH?.replace(/\/$/,'');if(mount&&pathname.startsWith(mount+'/'))pathname=pathname.slice(mount.length);
 if(pathname==='/api/leads'||pathname==='/api/guide'||pathname==='/api/report'){
  if(req.method!=='POST')return json(res,405,{error:'Yalnız POST desteklenir.'});
  const expectedOrigin=process.env.PUBLIC_ORIGIN||`${process.env.CBI_NETLIFY?'https':'http'}://${req.headers.host}`;
  if(req.headers.origin&&req.headers.origin!==expectedOrigin)return json(res,403,{error:'Bu kaynaktan talep kabul edilmiyor.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON içeriği gerekir.'});
  const key=(process.env.CBI_NETLIFY?req.headers['x-nf-client-connection-ip']:null)||req.socket.remoteAddress,b=limits.get(key)||{count:0,expires:Date.now()+60_000};if(Date.now()>b.expires){b.count=0;b.expires=Date.now()+60_000;}limits.set(key,b);if(++b.count>10)return json(res,429,{error:'Çok fazla deneme. Bir dakika sonra yeniden deneyin.'});
  let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32_768)return json(res,413,{error:'Talep boyutu çok büyük.'});}}catch{return json(res,400,{error:'Talep okunamadı.'});}
  let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'Geçersiz talep.'});}
  if(pathname==='/api/guide'){
   if(!data||typeof data.question!=='string'||data.question.trim().length<3||data.question.length>400)return json(res,422,{error:'Sorunuzu 3–400 karakter arasında yazın.'});
   const localTopic=helpTopic(data.question);if(localTopic)return json(res,200,safeHelp(localTopic));
   const today=new Date().toISOString().slice(0,10);if(today!==aiDay){aiDay=today;aiCalls=0;}
   if(aiCalls>=Number(process.env.GEMINI_DAILY_REQUEST_LIMIT||100))return json(res,200,safeHelp('general','fallback'));
   aiCalls++;
   return json(res,200,await guideQuestion(data.question));
  }
  if(pathname==='/api/report'){
   if(!['pdf','xlsx'].includes(data?.format)||!data.inputs||typeof data.inputs!=='object')return json(res,422,{error:'Rapor bilgileri geçersiz.'});
   const catalog=catalogs.get(data.inputs.sectorId||registry.defaultSector);if(!catalog)return json(res,422,{error:'Sektör verileri bulunamadı.'});
   const check=validateThroughStep(data.inputs,catalog,3);if(!check.ok)return json(res,422,{error:'Rapor için hesap bilgilerini tamamlayın.'});
   const result=calculate(data.inputs,catalog);if(!result.ok)return json(res,422,{error:'Hesap doğrulanamadı.'});
   try{const createdAt=new Date();const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(createdAt).replace(' ','_').replaceAll(':','-');const file=await exportReport(reportModel(data.inputs,result,catalog,data.example===true),data.format);res.writeHead(200,{'Content-Type':data.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="cbi-ithalat-raporu_${stamp}.${data.format}"`,'Cache-Control':'no-store'});return res.end(file);}catch{return json(res,503,{error:'Rapor hazırlanamadı. Lütfen tekrar deneyin.'});}
  }
  const c=data?.contact;
  if(!c||typeof c!=='object'||!data.inputs||typeof data.inputs!=='object')return json(res,400,{error:'İletişim ve hesap bilgileri gerekiyor.'});
  for(const [k,max,min]of [['name',120,2],['company',160,1],['email',180,3],['phone',30,0]])if(typeof c[k]!=='string'||c[k].trim().length<min||c[k].length>max||/[\x00-\x1f]/.test(c[k]))return json(res,422,{error:'İletişim bilgilerini kontrol edin.'});
  if(c.consent!==true||!/^\S+@\S+\.\S+$/.test(c.email))return json(res,422,{error:'Geçerli e-posta ve iletişim talebi onayı gerekir.'});
  const catalog=catalogs.get(data.inputs.sectorId||registry.defaultSector);
  if(!catalog)return json(res,422,{error:'Bu ürün sektörü hesaplamaya açık değil.'});
  const validation=validateThroughStep(data.inputs,catalog,3);if(!validation.ok)return json(res,422,{error:'Eksik bilgileri ilgili adımda tamamlayın.',fields:validation.errors,step:validation.step});
  let computed;try{computed=calculate(data.inputs,catalog);}catch{return json(res,422,{error:'Hesap bilgileri geçersiz.'});}
  if(!computed.ok)return json(res,422,{error:'Hesap bilgilerini tamamlayın.',fields:computed.errors});
  const id=randomUUID();const record={id,createdAt:new Date().toISOString(),contact:{name:c.name.trim(),company:c.company.trim(),email:c.email.trim(),phone:c.phone.trim(),consent:true,noticeVersion:'2026-10-01'},inputs:data.inputs,result:computed};
  try{if(process.env.CBI_NETLIFY){const {getStore}=await import('@netlify/blobs');await getStore('cbi-leads').setJSON(id,record);}else{await mkdir(storage,{recursive:true,mode:0o700});await appendFile(path.join(storage,'leads.jsonl'),JSON.stringify(record)+'\n',{mode:0o600});}}catch{return json(res,503,{error:'Talep şu anda kaydedilemiyor. Lütfen daha sonra deneyin.'});}
  return json(res,201,{id,message:'Hesap dökümünüz talebe eklendi. Doğrudan iletişim: +90 216 418 91 07.'});
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Desteklenmeyen işlem.'});
 const allowed=pathname==='/'||pathname==='/index.html'||pathname==='/data/sectors.json'||catalogPaths(registry).some(p=>pathname==='/'+p)||/^\/(src\/(matching\.js|money-input\.js|workflow\.js|sectors\.js|countries\.js|app\.js|engine\.js|rules\.js|guidance\.js|decimal\.js|styles\.css)|data\/catalog\.json|public\/assets\/cbi-logo-dark\.png)$/.test(pathname);
 if(!allowed)return json(res,404,{error:'Sayfa bulunamadı.'});
 try{const file=path.join(root,pathname==='/'?'index.html':pathname);const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);}catch{json(res,404,{error:'Dosya bulunamadı.'});}
};
if(!process.env.CBI_NETLIFY)http.createServer(requestHandler).listen(port,host,()=>console.log(`CBI önizleme: http://${host}:${port}`));
