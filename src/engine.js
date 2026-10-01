import {normalizeCode} from './matching.js';
import {isCountry} from './countries.js';
import {resolveTariff} from './rules.js';
import {convertMoney,surveillanceMoney,taxMoney,sumMoney,unitMoney} from './decimal.js';
export const GROUPS = {PREF:'AB / EFTA / STA',KTR:'KTR',BAE:'BAE',EAGU:'EAGÜ',OTDU:'ÖTDÜ',GYU:'GYÜ',DU:'Diğer ülkeler'};
export const money = n => convertMoney([n],1);
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if(typeof value!=='string') return NaN;
  const s=value.trim();
  // Unambiguous entry: no thousands separators. Accept either decimal mark.
  if(/^[1-9]\d{0,2}[.,]\d{3}$/.test(s))return NaN; // Ambiguous grouping: 1.000 must not silently become 1.
  return /^\d+(?:[.,]\d{1,6})?$/.test(s) ? Number(s.replace(',','.')) : NaN;
}
export function resolveSurveillance(product,input){
 if(product?.surveillanceVariants?.length){const variant=product.surveillanceVariants.find(v=>v.id===input.productVariant);return {rate:variant?.usdPerGrossTonne??null,variant,error:variant?null:'Bu ürün akülü araba mı? Ürün türünü seçin.'};}
 return {rate:product?.surveillanceRate??null,variant:null,error:product?.surveillanceStatus==='multiple'?'Bu ürünün gözetim alt türleri henüz tanımlanmamış.':null};
}
export function resolveProductCode(code,catalog){
 const normalized=normalizeCode(code);if(normalized.length!==12)return null;
 const direct=catalog.products.find(p=>normalizeCode(p.code)===normalized);if(direct)return {product:direct,originalCode:code,canonicalCode:direct.code,matchedAlias:false};
 const matches=catalog.products.filter(p=>normalizeCode(p.surveillanceCorrection?.sourceCode)===normalized&&p.surveillanceCorrection?.targetCode===p.code);
 if(matches.length!==1)return null;
 return {product:matches[0],originalCode:code,canonicalCode:matches[0].code,matchedAlias:true};
}
export function calculate(input, catalog) {
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,errors:{gtip:'Hesap bilgilerini yeniden girin.'}};
  if(Object.values(input).some(v=>v!==null&&!['string','number','boolean','undefined'].includes(typeof v)))return {ok:false,errors:{gtip:'Hesap bilgilerinin biçimi geçersiz. Alanları yeniden kontrol edin.'}};
  if(catalog.sectorId&&input.sectorId&&input.sectorId!==catalog.sectorId)return {ok:false,errors:{gtip:'Ürün sektörü ile hesaplama verileri uyuşmuyor.'}};
  if(catalog.model&&catalog.model!=='ad-valorem-v1')return {ok:false,errors:{gtip:'Bu hesaplama modeli desteklenmiyor.'}};
  const codeMatch=resolveProductCode(input.gtip,catalog);
  if(codeMatch)input={...input,gtip:codeMatch.canonicalCode};
  const decision=resolveTariff(input,catalog.tariffPolicy); input=decision.input;
  const errors = {};
  const guided=input.tariffMode==='guided';
  const num=(key,min=0,required=true)=>{
    if (!required && (input[key]===''||input[key]===undefined||input[key]===null)) return null;
    const n=parseAmount(input[key]);
    if(typeof input[key]==='string'&&/^[1-9]\d{0,2}[.,]\d{3}$/.test(input[key].trim())){errors[key]='Bu yazım belirsiz. Örneğin bin için 1000, bir için 1 yazın. Üç ondalık basamak gerekiyorsa sona bir sıfır ekleyin.';return 0;}
    if(!Number.isFinite(n)||n<min||n>1e9) {errors[key]=(input[key]===''||input[key]===undefined)?'Bu bilgi eksik. Alanın yanındaki yardım size nereden bulacağınızı gösterir.':`0 veya üzeri, en fazla 1 milyar olan bir sayı girin${min>0?' (bu alan sıfır olamaz)':''}. Binlik ayırıcı kullanmayın.`; return 0;}
    return n;
  };
  const product=catalog.products.find(p=>p.code===input.gtip);
  const surveillance=resolveSurveillance(product,input);
  if(surveillance.error)errors.productVariant=surveillance.error;
  const vatRate=product?.vatRate??catalog.vatRate;
  if(!Number.isFinite(vatRate)||vatRate<0||vatRate>100)errors.gtip="Ürünün KDV oranı eksik veya geçersiz.";
  if(!product) errors.gtip='Listeden bir GTİP seçin.';
  if(input.regime!=='standard') errors.regime='Bu hesaplayıcı yeni eşyanın ticari serbest dolaşıma girişini destekler. Diğer rejimler için uzman incelemesi gerekir.';
  const parsedDate=new Date(input.date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'')||!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==input.date||input.date<catalog.effectiveFrom||input.date>catalog.snapshotDate) errors.date=`Bu veri seti ${catalog.effectiveFrom} – ${catalog.snapshotDate} aralığını kapsar. Bu tarih için güncel tarife kontrolü gerekir.`;
  if(!isCountry(input.origin)) errors.origin='Üretildiği ülkeyi listeden seçin veya Bilmiyorum seçeneğini kullanın.';
  if(!isCountry(input.dispatch)) errors.dispatch='Sevk ülkesini listeden seçin veya Bilmiyorum seçeneğini kullanın.';
  for(const key of ['gvGroup','igvGroup']) if(decision.resolved&&!Object.hasOwn(GROUPS,input[key])) errors[key]='Uygulanacak tarife grubunu seçin.';
  if(decision.resolved&&input.tariffConfirmed!==true) errors.tariffConfirmed='Menşe ve belgeye göre tarife gruplarını teyit edin veya uzman desteği isteyin.';
  if(!['none','atr','origin','unknown'].includes(input.proof)) errors.proof='Belge durumunu seçin.';
  if((input.gvGroup==='PREF'||input.igvGroup==='PREF') && ['none','unknown'].includes(input.proof)) errors.proof='Tercihli oran için uygun dolaşım / menşe belgesinin teyidi gerekir.';
  if(input.igvGroup==='PREF' && input.preferentialOrigin!==true) errors.preferentialOrigin='İGV istisnasına esas menşe koşulunu ayrıca teyit edin. A.TR tek başına menşe belgesi değildir.';
  const quantity=num('quantity',1); if(!Number.isInteger(quantity)) errors.quantity='Adedi tam sayı girin.';
  const grossKg=num('grossKg',0.001);
  const fx=num('fx',0.000001), usdFx=num('usdFx',0.000001);
  if(!['USD','EUR','TRY'].includes(input.currency)) errors.currency='Para birimi seçin.';
  if(input.currency==='TRY'&&fx!==1) errors.fx='TL için kur 1 olmalıdır.';
  if(input.currency==='USD'&&fx!==usdFx) errors.usdFx='USD işlem kuru ve gözetim USD kuru aynı olmalıdır.';
  if(!['goods','cif'].includes(input.basis)) errors.basis='Bedelin içeriğini seçin.';
  const invoice=num('invoice',0.01);
  const freight=input.basis==='goods'?num('freight'):0;
  const insurance=input.basis==='goods'?num('insurance'):0;
  const adjustments=num('adjustments');
  let actual=0,reference=null;
  try{actual=convertMoney([invoice,freight,insurance,adjustments],fx);reference=surveillance.rate!=null?surveillanceMoney(grossKg,surveillance.rate,usdFx):null;}catch{errors.invoice='Bedel, ağırlık veya kur çok büyük. Birimleri kontrol edin.';}
  const below=reference!==null&&actual<reference;
  if(product?.surveillanceStatus==='conflict') errors.gtip='Bu GTİP için kaynak kodları uyuşmuyor. Gözetim eşleştirmesi uzman tarafından düzeltilmeden toplam hesaplanamaz.';
  if(!['actual','certificate','uplift',...(guided?['unknown']:[])].includes(input.scenario)) errors.scenario='Beyan senaryosunu seçin.';
  let base=actual, uplift=0;
  if(input.scenario==='certificate'&&input.certificateConfirmed!==true) errors.certificateConfirmed='Gözetim belgesinin bu eşya ve işlem için geçerli olduğunu teyit edin.';
  if(input.scenario==='uplift') {
    try{base=convertMoney([num('declared',0.01)],fx);}catch{errors.declared='Beyan tutarı veya kur desteklenen sınırı aşıyor.';}
    if(base<actual) errors.declared='Beyan kıymeti gerçek gümrük kıymetinden düşük olamaz.';
    if(input.upliftConfirmed!==true) errors.upliftConfirmed='Artırılmış beyanın uygulanabilirliği müşavirle teyit edilmelidir.';
    if(below&&base<reference) errors.declared='Beyan tutarı gözetim referansının altında. Bu senaryo için belge / uygulama kontrolü gerekir.';
    uplift=money(Math.max(0,base-actual));
  }
  const otherTaxes=num('otherTaxes',0,false), vatExpenses=num('vatExpenses',0,false), outsideExpenses=num('outsideExpenses',0,false);
  if(guided&&!['prepaid','deferred','unknown'].includes(input.payment))errors.payment='Ödemenin ne zaman yapılacağını seçin. Emin değilseniz Bilmiyorum seçebilirsiniz.';
  if(guided&&!['unknown','standard','auto-standard'].includes(input.tariffChoice))errors.tariffChoice='Hesaplama yolunu seçin.';
  const rates=product&&Object.hasOwn(GROUPS,input.gvGroup)&&Object.hasOwn(GROUPS,input.igvGroup)?{gv:product.customs[input.gvGroup],igv:product.additional[input.igvGroup]}:{gv:null,igv:null};
  if(decision.resolved&&rates&&(!Number.isFinite(rates.gv)||!Number.isFinite(rates.igv))) errors.gtip='Bu ürün için tarife oranı eksik.';
  if(Object.keys(errors).length) return {ok:false,errors};
  const unresolvedScenario=guided&&input.scenario==='unknown'&&below;
  const paymentUnresolved=guided&&(input.payment==='unknown'||(input.payment==='deferred'&&input.paymentReviewed!==true));
  let gv=null,igv=null,vatBase=null,vat=null,taxes=null,cash=null;
  const expensesKnown=otherTaxes!==null&&vatExpenses!==null&&!paymentUnresolved;
  try{
    if(decision.resolved&&!unresolvedScenario){gv=taxMoney(base,rates.gv);igv=taxMoney(base,rates.igv);}
    if(gv!==null&&expensesKnown){vatBase=sumMoney([base,gv,igv,otherTaxes,vatExpenses]);vat=taxMoney(vatBase,vatRate);taxes=sumMoney([gv,igv,otherTaxes,vat]);}
    if(taxes!==null&&outsideExpenses!==null)cash=sumMoney([actual,taxes,vatExpenses,outsideExpenses]);
  }catch{return {ok:false,errors:{invoice:'Hesap tutarı desteklenen sınırı aşıyor. Bedel, kur ve birimleri kontrol edin.'}};}
  const unresolved=(below&&input.scenario==='actual')||unresolvedScenario||decision.review;
  const warnings=[...decision.assumptions];
  if(codeMatch?.matchedAlias)warnings.push(`Girilen ${codeMatch.originalCode} kodu kayıtlı kaynak eşleştirmesiyle ${codeMatch.canonicalCode} koduna yönlendirildi.`);
  if(product.surveillanceCorrection)warnings.push(product.surveillanceCorrection.note);
  if(paymentUnresolved)warnings.push('Ödeme şeklinin diğer vergi ve fonlara etkisi henüz teyit edilmedi. KDV ve toplam nakit ihtiyacı tamamlanmadı.');
  if(unresolvedScenario)warnings.push('Gözetim referansının altındasınız ve belge / beyan durumu bilinmiyor. Uygulanabilir senaryo belirlenmeden vergi hesaplanmadı.');
  if(below&&input.scenario==='actual') warnings.push('Gerçek kıymet gözetim referansının altında. Gerçek kıymet üzerinden hesap gösterilir; gözetim belgesi / ithalat şartı henüz çözülmüş sayılmaz.');
  if(!expensesKnown||outsideExpenses===null) warnings.push('Bilinmeyen giderler sıfır kabul edilmedi. Toplam nakit ihtiyacı için boş kalan giderleri tamamlayın.');
  if(uplift>0) warnings.push('Kıymet artışı tedarikçiye ödenen tutara eklenmez; yalnızca beyan matrahını etkiler. KDV indirim hakkı bu hesapta hesaplanmaz.');
  if(product.tareksDescription) warnings.push('Ürün denetim listesinde yer alıyor. TAREKS / test giderleri sabit değildir; gerçekleşecek giderleri ayrıca girin.');
  return {ok:true,errors:{},product,codeMatch,surveillanceRate:surveillance.rate,productVariant:surveillance.variant?.label||null,rates,tariffRule:decision.rule,rulesVersion:'2026-10-01-guidance-v2',tariffGroups:{gv:input.gvGroup,igv:input.igvGroup},tariffResolved:decision.resolved,paymentUnresolved,actual,reference,below,base:unresolvedScenario?null:base,uplift,gv,igv,otherTaxes,vatExpenses,outsideExpenses,vatBase,vat,taxes,cash,unitCash:cash===null?null:unitMoney(cash,quantity),quantity,grossKg,warnings,status:unresolved?'review':cash===null?'partial':'estimate',sectorId:catalog.sectorId||input.sectorId||null,model:catalog.model||'ad-valorem-v1',version:catalog.version,vatRate};
}
