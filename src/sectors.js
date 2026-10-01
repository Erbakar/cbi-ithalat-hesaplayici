// Shared catalog boundary for browser and server. No invented rates for planned sectors.
export const isActiveSector=s=>s&&['pilot','active'].includes(s.status);
export function getSector(registry,id){return registry.sectors.find(s=>s.id===id);}
export function catalogPaths(registry){return registry.sectors.filter(isActiveSector).map(s=>s.catalogPath);}
export async function loadSectorCatalog(registry,id,readJSON){
 const sector=getSector(registry,id);
 if(!isActiveSector(sector))throw new Error('Bu ürün grubu henüz hesaplamaya açık değil.');
 if(!/^data\/[a-zA-Z0-9_/-]+\.json$/.test(sector.catalogPath)||sector.catalogPath.includes('..'))throw new Error('Geçersiz katalog yolu.');
 if(sector.model!=='ad-valorem-v1'||sector.surveillanceUnit!=='USD/gross-tonne')throw new Error('Bu sektörün hesaplama modeli henüz desteklenmiyor.');
 const catalog=await readJSON(sector.catalogPath);
 if(!catalog.version||!catalog.effectiveFrom||!catalog.snapshotDate||!Array.isArray(catalog.products)||!catalog.products.length||!Array.isArray(catalog.sources))throw new Error('Katalog kaynakları veya tarihleri eksik.');
 if(new Set(catalog.products.map(p=>p.code)).size!==catalog.products.length)throw new Error('Katalogda tekrarlanan GTİP var.');
 for(const product of catalog.products){
  if(!/^\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(product.code)||!product.label||!product.customs||!product.additional)throw new Error('Ürün verisi eksik.');
  const vat=product.vatRate??catalog.vatRate;
  if(!Number.isFinite(vat)||vat<0||vat>100)throw new Error('KDV oranı eksik veya geçersiz.');
  if(product.calculationModel&&product.calculationModel!==sector.model)throw new Error('Ürünün özel hesaplama modeli desteklenmiyor.');
  if(product.surveillanceUnit&&product.surveillanceUnit!==sector.surveillanceUnit)throw new Error('Gözetim birimi için ayrı hesaplama modeli gerekiyor.');
  if(product.requiredRules?.length)throw new Error('Ürünün ek hesaplama kuralları uygulanmadan kategori açılamaz.');
 }
 return {...catalog,sectorId:id,sectorLabel:sector.label,model:sector.model,surveillanceUnit:sector.surveillanceUnit,tariffPolicy:sector.tariffPolicy||'expert-only',groups:sector.groups||[],searchExample:sector.searchExample||'Ürün adı veya 12 haneli GTİP'};
}
