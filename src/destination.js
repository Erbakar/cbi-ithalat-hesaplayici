// Destination-import model (destination-import-v1).
// A foreign buyer purchases Turkish-origin goods at a fair in Türkiye and imports them into the EU or the UK.
// Duties come from the sector catalog snapshot (EU TARIC / UK Trade Tariff); nothing is guessed.
// A rate that is not a plain percentage, an unresolved tariff split or a trade-defence measure makes the
// result "review": the duty is not invented and the totals stay incomplete.
import {convertMoney,taxMoney,sumMoney,unitMoney} from './decimal.js';
import {parseAmount} from './amount.js';

export const MODEL='destination-import-v1';
// Standard VAT rates (2026). Reduced rates are not applied automatically.
export const DESTINATIONS=[
 ['DE','Almanya',19],['AT','Avusturya',20],['BE','Belçika',21],['BG','Bulgaristan',20],['CZ','Çekya',21],['DK','Danimarka',25],
 ['EE','Estonya',24],['FI','Finlandiya',25.5],['FR','Fransa',20],['HR','Hırvatistan',25],['NL','Hollanda',21],['IE','İrlanda',23],
 ['ES','İspanya',21],['SE','İsveç',25],['IT','İtalya',22],['CY','Kıbrıs (GKRY)',19],['LV','Letonya',21],['LT','Litvanya',21],
 ['LU','Lüksemburg',17],['HU','Macaristan',27],['MT','Malta',18],['PL','Polonya',23],['PT','Portekiz',23],['RO','Romanya',21],
 ['SK','Slovakya',23],['SI','Slovenya',22],['GR','Yunanistan',24]
].map(([id,label,vat])=>({id,label,vat,bloc:'EU',currency:'EUR'})).concat([{id:'GB',label:'Birleşik Krallık',vat:20,bloc:'UK',currency:'GBP'}]);
export const destination=id=>DESTINATIONS.find(d=>d.id===id)||null;
export const BLOCS={EU:'Avrupa Birliği (TARIC)',UK:'Birleşik Krallık (UK Global Tariff)'};
export const PROOF={EU:'A.TR dolaşım belgesi (AB–Türkiye Gümrük Birliği)',UK:'Türkiye–Birleşik Krallık STA menşe ispatı (EUR.1 veya faturada menşe beyanı)'};
export const CURRENCIES=['EUR','USD','GBP','TRY'];
export const STEPS=['Ürününüz','Hedef ülke & belge','Sevkiyat','Giderler','Sonucunuz'];
export const STEP_KEYS=[['gtip'],['destination','variant','proof','proofConfirmed'],['quantity','currency','fx','basis','invoice','freight','insurance','adjustments'],['otherTaxes','vatExpenses','outsideExpenses']];
export const FIELD_LABELS={gtip:'Ürün seçimi',variant:'Hedef ülke alt kodu',destination:'Hedef ülke',proof:'Menşe belgesi',proofConfirmed:'Belge teyidi',quantity:'Miktar',currency:'Fatura para birimi',fx:'Kur',basis:'Bedelin kapsamı',invoice:'Mal bedeli',freight:'Navlun',insurance:'Sigorta',adjustments:'Diğer kıymet ilaveleri',otherTaxes:'Diğer vergi ve harçlar',vatExpenses:'KDV matrahına dahil giderler',outsideExpenses:'Diğer nakit giderler'};
export const initialDestination=sectorId=>({sectorId,gtip:'',variant:'',destination:'',proof:'',proofConfirmed:false,quantity:'',currency:'EUR',fx:'1',basis:'goods',invoice:'',freight:'',insurance:'',adjustments:'0',otherTaxes:'',vatExpenses:'',outsideExpenses:''});

export function updateDestinationInput(state,key,value){
 if(state[key]===value)return state;
 const next={...state,[key]:value};
 const cur=destination(next.destination)?.currency;
 if(key==='gtip')next.variant='';
 if(key==='destination'){next.variant='';next.proofConfirmed=false;next.fx=cur&&next.currency===cur?'1':'';}
 if(key==='currency')next.fx=cur&&value===cur?'1':'';
 if(key==='proof')next.proofConfirmed=false;
 return next;
}

export function tariffFor(product,catalog,bloc,variant){
 const t=catalog.tariffs?.[product?.cn8]?.[bloc];
 if(!t)return {status:'not-found',reasons:['Bu kod hedef ülke tarifesinde bulunamadı.']};
 if(t.variants?.length){
  const v=t.variants.find(x=>x.commodity===variant);
  if(!v)return {...t,needsVariant:true};
  return {...t,...v,variantLabel:v.description,vat:t.vat};
 }
 return {...t,commodity:t.commodities?.[0]};
}

export function calculateDestination(input,catalog){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,errors:{gtip:'Hesap bilgilerini yeniden girin.'}};
 if(Object.values(input).some(v=>v!==null&&!['string','number','boolean','undefined'].includes(typeof v)))return {ok:false,errors:{gtip:'Hesap bilgilerinin biçimi geçersiz. Alanları yeniden kontrol edin.'}};
 if(catalog.sectorId&&input.sectorId&&input.sectorId!==catalog.sectorId)return {ok:false,errors:{gtip:'Ürün sektörü ile hesaplama verileri uyuşmuyor.'}};
 const errors={};
 const num=(key,min=0,required=true)=>{
  if(!required&&(input[key]===''||input[key]===undefined||input[key]===null))return null;
  if(typeof input[key]==='string'&&/^[1-9]\d{0,2}[.,]\d{3}$/.test(input[key].trim())){errors[key]='Bu yazım belirsiz. Örneğin bin için 1000, bir için 1 yazın.';return 0;}
  const n=parseAmount(input[key]);
  if(!Number.isFinite(n)||n<min||n>1e9){errors[key]=(input[key]===''||input[key]===undefined||input[key]===null)?'Bu bilgi eksik.':`0 veya üzeri, en fazla 1 milyar olan bir sayı girin${min>0?' (bu alan sıfır olamaz)':''}. Binlik ayırıcı kullanmayın.`;return 0;}
  return n;
 };
 const product=catalog.products.find(p=>p.code===input.gtip);
 if(!product)errors.gtip='Listeden bir GTİP seçin.';
 const dest=destination(input.destination);
 if(!dest)errors.destination='Malın gideceği ülkeyi seçin.';
 const tariff=product&&dest?tariffFor(product,catalog,dest.bloc,input.variant):null;
 if(tariff?.needsVariant)errors.variant='Bu GTİP hedef ülke tarifesinde birden fazla alt koda ayrılıyor. Ürününüze uyan alt kodu seçin.';
 if(!['pref','none','unknown'].includes(input.proof))errors.proof='Menşe belgesi durumunu seçin.';
 if(input.proof==='pref'&&input.proofConfirmed!==true)errors.proofConfirmed='Belgenin bu sevkiyat için düzenleneceğini teyit edin.';
 const quantity=num('quantity',1);if(!errors.quantity&&!Number.isInteger(quantity))errors.quantity='Miktarı tam sayı girin.';
 if(!CURRENCIES.includes(input.currency))errors.currency='Para birimi seçin.';
 const fx=num('fx',0.000001);
 if(dest&&input.currency===dest.currency&&fx!==1)errors.fx=`Fatura ${dest.currency} ise kur 1 olmalıdır.`;
 if(!['goods','cif'].includes(input.basis))errors.basis='Bedelin içeriğini seçin.';
 const invoice=num('invoice',0.01);
 const freight=input.basis==='goods'?num('freight'):0;
 const insurance=input.basis==='goods'?num('insurance'):0;
 const adjustments=num('adjustments');
 const otherTaxes=num('otherTaxes',0,false),vatExpenses=num('vatExpenses',0,false),outsideExpenses=num('outsideExpenses',0,false);
 let customsValue=0;
 try{customsValue=convertMoney([invoice,freight,insurance,adjustments],fx);}catch{errors.invoice='Bedel veya kur çok büyük. Birimleri kontrol edin.';}
 if(Object.keys(errors).length)return {ok:false,errors};

 const prefAvailable=tariff.preference&&tariff.preference.rate!=null;
 const usePref=input.proof==='pref'&&input.proofConfirmed===true&&prefAvailable;
 const rateInfo=usePref?tariff.preference:tariff.thirdCountry;
 const dutyRate=tariff.status==='ok'&&rateInfo&&Number.isFinite(rateInfo.rate)?rateInfo.rate:null;
 const warnings=[];
 const review=tariff.status!=='ok'||input.proof==='unknown';
 if(tariff.status!=='ok')warnings.push(...tariff.reasons,'Gümrük vergisi uzman incelemesi olmadan hesaplanmadı.');
 if(input.proof==='unknown')warnings.push(`Menşe belgesi netleşmedi. Ön hesapta Türkiye tercihi değil, genel vergi oranı kullanıldı. ${PROOF[dest.bloc]} düzenlenirse vergi düşebilir.`);
 if(input.proof==='pref'&&!prefAvailable)warnings.push('Bu üründe Türkiye için ayrı bir tercihli oran yok; genel oran uygulandı.');
 if(input.proof==='none')warnings.push('Menşe belgesi olmadan genel (üçüncü ülke) vergi oranı uygulandı.');
 if(tariff.quota)warnings.push('Bu kod için tarife kotası tanımlı. Kota kapsamındaki daha düşük oran bu hesapta kullanılmadı.');
 if(dest.bloc==='EU'&&customsValue<=150)warnings.push('Gümrük kıymeti 150 EUR veya altında. AB’nin düşük değerli gönderilere yönelik ek vergi ve işlem ücretleri bu hesapta yer almıyor.');
 if(dest.bloc==='UK'&&tariff.vat?.includes('0.00 %'))warnings.push('Birleşik Krallık’ta bu kod için bazı ürünlere (örneğin çocuk ayakkabısı / giysisi) %0 KDV uygulanabilir. Hesapta standart %20 kullanıldı.');
 warnings.push(`İthalat KDV’si ${dest.label} standart oranı (%${dest.vat}) ile hesaplandı. Ürüne özel indirimli oran varsa alıcı kendi müşavirine teyit ettirmelidir.`);

 let duty=null,vatBase=null,vat=null,taxes=null,cash=null;
 const expensesKnown=otherTaxes!==null&&vatExpenses!==null;
 try{
  if(dutyRate!==null)duty=taxMoney(customsValue,dutyRate);
  if(duty!==null&&expensesKnown){vatBase=sumMoney([customsValue,duty,otherTaxes,vatExpenses]);vat=taxMoney(vatBase,dest.vat);taxes=sumMoney([duty,otherTaxes,vat]);}
  if(taxes!==null&&outsideExpenses!==null)cash=sumMoney([customsValue,taxes,vatExpenses,outsideExpenses]);
 }catch{return {ok:false,errors:{invoice:'Hesap tutarı desteklenen sınırı aşıyor. Bedel ve kuru kontrol edin.'}};}
 if(!expensesKnown||outsideExpenses===null)warnings.push('Bilinmeyen giderler sıfır kabul edilmedi. Toplam için boş kalan giderleri tamamlayın.');
 return {ok:true,errors:{},model:MODEL,product,destination:dest,tariff,usePref,dutyRate,dutyLabel:rateInfo?`${usePref?(dest.bloc==='EU'?'AB–Türkiye Gümrük Birliği oranı':'Türkiye–Birleşik Krallık STA tercihli oranı'):'Genel (üçüncü ülke) vergi'} · %${String(rateInfo.rate).replace('.',',')}`:'Oran bulunamadı',customsValue,duty,otherTaxes,vatExpenses,outsideExpenses,vatBase,vat,vatRate:dest.vat,taxes,cash,unitCash:cash===null?null:unitMoney(cash,quantity),quantity,currency:dest.currency,warnings,status:review?'review':cash===null?'partial':'estimate',sectorId:catalog.sectorId||input.sectorId||null,version:catalog.version};
}

export function destinationWorkflowErrors(input,catalog){
 const errors={...calculateDestination(input,catalog).errors};
 if(input.proof==='unknown')delete errors.proof;
 for(const key of ['otherTaxes','vatExpenses','outsideExpenses'])if(input[key]===''||input[key]==null)errors[key]='Tutarı girin. Bu gider gerçekten yoksa “Yok · 0” seçin.';
 return errors;
}
