/**
 * Cloudflare Worker for trade-commerce.com/freight-forwarding (Freight Forwarding).
 * Serves the calculator from the built `dist` assets under the mount path and the two
 * server features that need no Node runtime: AI help (/api/guide) and leads (/api/leads, D1).
 * PDF/Excel reports (/api/report) are not available here yet; their buttons are hidden.
 * The Netlify/Node server (server.mjs) is unchanged.
 */
import {validateThroughStep} from './src/workflow.js';
import {loadSectorCatalog,catalogPaths} from './src/sectors.js';
import {calculate} from './src/engine.js';
import {guideQuestion,safeHelp} from './assistant.mjs';
import {helpTopic} from './src/guidance.js';

const MOUNT='/freight-forwarding';
const ORIGINS=new Set(['https://trade-commerce.com','https://www.trade-commerce.com']);
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"};
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...SECURITY}});

let ready,registry;const catalogs=new Map();
function load(env){
 return ready??=(async()=>{
  const read=async file=>{const r=await env.ASSETS.fetch(new Request('https://assets.local/'+file));if(!r.ok)throw new Error('catalog '+file);return r.json();};
  registry=await read('data/sectors.json');
  for(const sector of registry.sectors.filter(s=>catalogPaths(registry).includes(s.catalogPath)))catalogs.set(sector.id,await loadSectorCatalog(registry,sector.id,read));
 })().catch(e=>{ready=undefined;throw e;});
}

// Per-isolate limit: a soft brake, like the Node server's in-memory limiter.
const limits=new Map();
function limited(ip){const now=Date.now();const b=limits.get(ip)||{count:0,expires:now+60_000};if(now>b.expires){b.count=0;b.expires=now+60_000;}b.count++;limits.set(ip,b);if(limits.size>5000)limits.clear();return b.count>20;}
let aiDay='',aiCalls=0;

async function api(request,env,name){
 if(request.method!=='POST')return json(405,{error:'Yalnız POST desteklenir.'});
 const origin=request.headers.get('origin');if(origin&&!ORIGINS.has(origin))return json(403,{error:'Bu kaynaktan talep kabul edilmiyor.'});
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json(415,{error:'JSON içeriği gerekir.'});
 if(limited(request.headers.get('cf-connecting-ip')||'unknown'))return json(429,{error:'Çok fazla talep gönderildi. Lütfen biraz sonra deneyin.'});
 const body=await request.text();if(body.length>32_768)return json(413,{error:'Talep boyutu çok büyük.'});
 let data;try{data=JSON.parse(body);}catch{return json(400,{error:'Geçersiz talep.'});}
 if(name==='report')return json(503,{error:'Rapor indirme bu sürümde henüz açık değil.'});
 await load(env);
 if(name==='guide'){
  if(!data||typeof data.question!=='string'||data.question.trim().length<3||data.question.length>400)return json(422,{error:'Sorunuzu 3–400 karakter arasında yazın.'});
  const local=helpTopic(data.question);if(local)return json(200,safeHelp(local));
  const today=new Date().toISOString().slice(0,10);if(today!==aiDay){aiDay=today;aiCalls=0;}
  if(aiCalls>=Number(env.GEMINI_DAILY_REQUEST_LIMIT||100))return json(200,safeHelp('general','fallback'));
  aiCalls++;
  return json(200,await guideQuestion(data.question,{key:env.GEMINI_API_KEY,model:env.GEMINI_MODEL}));
 }
 // leads
 const c=data?.contact;
 if(!c||typeof c!=='object'||!data.inputs||typeof data.inputs!=='object')return json(400,{error:'İletişim ve hesap bilgileri gerekiyor.'});
 for(const [k,max,min]of [['name',120,2],['company',160,1],['email',180,3],['phone',30,0]])if(typeof c[k]!=='string'||c[k].trim().length<min||c[k].length>max||/[\x00-\x1f]/.test(c[k]))return json(422,{error:'İletişim bilgilerini kontrol edin.'});
 if(c.consent!==true||!/^\S+@\S+\.\S+$/.test(c.email))return json(422,{error:'Geçerli e-posta ve iletişim talebi onayı gerekir.'});
 const catalog=catalogs.get(data.inputs.sectorId||registry.defaultSector);
 if(!catalog)return json(422,{error:'Bu ürün sektörü hesaplamaya açık değil.'});
 const validation=validateThroughStep(data.inputs,catalog,3);if(!validation.ok)return json(422,{error:'Eksik bilgileri ilgili adımda tamamlayın.',fields:validation.errors,step:validation.step});
 let computed;try{computed=calculate(data.inputs,catalog);}catch{return json(422,{error:'Hesap bilgileri geçersiz.'});}
 if(!computed.ok)return json(422,{error:'Hesap bilgilerini tamamlayın.',fields:computed.errors});
 const id=crypto.randomUUID(),createdAt=new Date().toISOString();
 const record={id,createdAt,contact:{name:c.name.trim(),company:c.company.trim(),email:c.email.trim(),phone:c.phone.trim(),consent:true,noticeVersion:'2026-10-01'},inputs:data.inputs,result:computed};
 await env.DB.prepare('INSERT INTO leads (id,created_at,email,company,record) VALUES (?,?,?,?,?)').bind(id,createdAt,record.contact.email,record.contact.company,JSON.stringify(record)).run();
 return json(201,{id,message:env.LEAD_MESSAGE||'Hesap dökümünüz talebe eklendi. En kısa sürede sizinle iletişime geçeceğiz.'});
}

// The report buttons need the Node runtime; hide them on this deployment.
class HideReports{element(e){e.append('<style>#print,#download{display:none!important}</style>',{html:true});}}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname===MOUNT)return Response.redirect(url.origin+MOUNT+'/'+url.search,301);
  if(!url.pathname.startsWith(MOUNT+'/'))return new Response('Not found',{status:404});
  const path=url.pathname.slice(MOUNT.length);
  const api_=path.match(/^\/api\/(guide|leads|report)$/);
  if(api_)return api(request,env,api_[1]);
  if(!['GET','HEAD'].includes(request.method))return json(405,{error:'Desteklenmeyen işlem.'});
  const allowed=path==='/'||path==='/index.html'||/^\/(src\/[a-z-]+\.(js|css)|data\/[a-z-]+\.json|public\/assets\/[\w.-]+\.(png|svg|jpg|webp))$/.test(path);
  if(!allowed)return json(404,{error:'Sayfa bulunamadı.'});
  const asset=await env.ASSETS.fetch(new Request(new URL(path==='/'?'/index.html':path,'https://assets.local'),{method:request.method}));
  if(!asset.ok)return asset;
  const headers=new Headers(asset.headers);for(const [k,v]of Object.entries(SECURITY))headers.set(k,v);headers.set('Cache-Control','no-cache');
  const response=new Response(asset.body,{status:asset.status,headers});
  return (path==='/'||path==='/index.html')?new HTMLRewriter().on('head',new HideReports()).transform(response):response;
 },
};
