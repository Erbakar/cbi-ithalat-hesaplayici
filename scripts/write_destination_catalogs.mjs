// Turns the tariff snapshot from build_destination_catalogs.py (.cache/<sector>-destination.json)
// into data/<sector>.json and refreshes the sector's product groups in data/sectors.json.
// Usage: node scripts/write_destination_catalogs.mjs
import {readFile,writeFile} from 'node:fs/promises';

const SECTORS={
 textiles:{
  label:'İplik & tekstil',searchExample:'Örn. pamuk ipliği veya 5205.11.00.00.00',
  groups:[
   ['wool','Yün & hayvan kılı','Yapağı, yün ipliği ve kumaşı','yarn',c=>c.startsWith('51')],
   ['cotton','Pamuk','Pamuk lifi, iplik ve dokuma','yarn',c=>c.startsWith('52')],
   ['plant','Keten & bitkisel lifler','Keten, kendir, jüt ve diğerleri','yarn',c=>c.startsWith('53')],
   ['filament','Sentetik & suni filament','Filament iplik ve dokumaları','fabric',c=>c.startsWith('54')],
   ['staple','Sentetik & suni devamsız lif','Lif, iplik ve dokumaları','fabric',c=>c.startsWith('55')],
   ['nonwoven','Vatka, keçe, ip & halat','Dokunmamış mensucat, sicim, ağ','rope',c=>c.startsWith('56')],
  ]},
 footwear:{
  label:'Ayakkabı',searchExample:'Örn. deri ayakkabı veya 6403.99.93.00.00',
  groups:[
   ['rubber','Kauçuk & plastik','Su geçirmez ve diğer kauçuk/plastik ayakkabılar','shoe',c=>c.startsWith('6401')||c.startsWith('6402')],
   ['leather','Deri yüzlü','Yüzü deri olan ayakkabılar','shoe',c=>c.startsWith('6403')],
   ['textile','Tekstil yüzlü','Yüzü dokumaya elverişli maddeden','shoe',c=>c.startsWith('6404')],
   ['other','Diğer ayakkabılar','Diğer malzemelerden ayakkabılar','shoe',c=>c.startsWith('6405')],
   ['parts','Ayakkabı parçaları','Saya, taban, topuk ve diğer aksam','part',c=>c.startsWith('6406')],
  ]},
};

const registryPath=new URL('../data/sectors.json',import.meta.url);
const registry=JSON.parse(await readFile(registryPath,'utf8'));
for(const [id,cfg] of Object.entries(SECTORS)){
 const snap=JSON.parse(await readFile(new URL(`../.cache/${id}-destination.json`,import.meta.url),'utf8'));
 const products=snap.products.map(({code,label,context,heading,unit,cn8,sourceFile,sourceRow})=>({code,label,context,heading,unit,cn8,sourceFile,sourceRow}));
 const catalog={
  version:`${snap.snapshotDate}-destination-v1`,model:'destination-import-v1',origin:'TR',snapshotDate:snap.snapshotDate,effectiveFrom:snap.snapshotDate,
  note:'Türk menşeli malın AB veya Birleşik Krallık’a ithalatı. GTİP’in ilk 8 hanesi hedef ülke tarifesiyle (AB Kombine Nomenklatür) eşlenir. Excel’deki 474 s.K.V.O. sütunu kullanılmaz.',
  products,tariffs:snap.tariffs,
  sources:[...snap.excelSources.map(s=>({file:s.file,sha256:s.sha256})),
   {file:'AB tarifesi: TARIC ölçüleri, HMRC Trade Tariff XI servisi',url:'https://www.trade-tariff.service.gov.uk/xi/api/v2'},
   {file:'Birleşik Krallık tarifesi: UK Global Tariff, HMRC Trade Tariff',url:'https://www.trade-tariff.service.gov.uk/api/v2'},
   {file:'AB üye ülke standart KDV oranları (2026)',url:'https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates_en'}],
 };
 await writeFile(new URL(`../data/${id}.json`,import.meta.url),JSON.stringify(catalog)+'\n');
 const groups=cfg.groups.map(([gid,label,description,icon,match])=>({id:gid,label,description,icon,productCodes:products.filter(p=>match(p.code.replaceAll('.',''))).map(p=>p.code)}));
 const missing=products.filter(p=>!groups.some(g=>g.productCodes.includes(p.code)));
 if(missing.length)throw new Error(`${id}: ${missing.length} ürün hiçbir gruba girmedi`);
 const entry={id,label:cfg.label,status:'active',catalogPath:`data/${id}.json`,model:'destination-import-v1',searchExample:cfg.searchExample,groups};
 const i=registry.sectors.findIndex(s=>s.id===id);
 if(i>=0)registry.sectors[i]=entry;else registry.sectors.splice(registry.sectors.findIndex(s=>s.status==='planned'),0,entry);
 const counts={};for(const t of Object.values(snap.tariffs))for(const [b,v] of Object.entries(t))counts[b+':'+v.status]=(counts[b+':'+v.status]||0)+1;
 console.log(id,products.length,'ürün',Object.keys(snap.tariffs).length,'CN8',counts);
}
if(!registry.sectors.some(s=>s.id==='stationery'))registry.sectors.splice(registry.sectors.findIndex(s=>s.id==='technology'),0,{id:'stationery',label:'Kırtasiye',status:'planned'});
const ORDER=['toys','textiles','footwear','stationery','technology','other'];
registry.sectors.sort((a,b)=>(ORDER.indexOf(a.id)+1||99)-(ORDER.indexOf(b.id)+1||99));
await writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
