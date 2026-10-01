// Only explicit, inspectable decisions belong here. Model output never enters this module.
export const EU_COUNTRIES = ['Almanya','Avusturya','Belçika','Bulgaristan','Çekya','Danimarka','Estonya','Finlandiya','Fransa','Hırvatistan','Hollanda','İrlanda','İspanya','İsveç','İtalya','Kıbrıs','Letonya','Litvanya','Lüksemburg','Macaristan','Malta','Polonya','Portekiz','Romanya','Slovakya','Slovenya','Yunanistan'];
export const normalizeCountry = v => typeof v==='string' ? v.trim().toLocaleLowerCase('tr') : '';
const isEU=v=>EU_COUNTRIES.some(c=>normalizeCountry(c)===normalizeCountry(v));
export function resolveTariff(input,policy='eu-confirmed-atr-v1'){
  if(input.tariffMode!=='guided')return {input,resolved:true,rule:'expert-selection',assumptions:[]};
  const next={...input,gvGroup:'',igvGroup:'',tariffConfirmed:false,preferentialOrigin:false};
  if(input.tariffChoice==='standard')return {input:{...next,gvGroup:'DU',igvGroup:'DU',tariffConfirmed:true,proof:input.proof||'unknown'},resolved:true,rule:'explicit-standard-scenario',review:true,assumptions:['Karşılaştırma için Diğer Ülkeler tarifesi kullanıldı. Ülke ve tercihli belgeye göre uygulanacak gerçek oran henüz doğrulanmadı.']};
  if(policy==='eu-confirmed-atr-v1'&&isEU(input.origin)&&isEU(input.dispatch)&&input.proof==='atr'&&input.documentConfirmed===true){
    return {input:{...next,gvGroup:'PREF',igvGroup:'PREF',tariffConfirmed:true,preferentialOrigin:true},resolved:true,rule:'eu-origin-eu-dispatch-confirmed-atr',assumptions:['AB menşei ve geçerli A.TR bilgileri kullanıcı tarafından doğrulandı; tercihli hesap bu bilgilere bağlıdır.']};
  }
  if(input.tariffChoice==='auto-standard'){const result=resolveTariff({...input,tariffChoice:'standard'},policy);return {...result,rule:'guided-standard-scenario'};}
  return {input:next,resolved:false,rule:'tariff-review-needed',assumptions:['Menşe ve belgelere göre vergi oranı henüz belirlenmedi. Vergi ve toplam nakit tutarı üretilmedi.']};
}
export const DECISION_DEPENDENCIES={
 productVariant:['certificateConfirmed','upliftConfirmed'],
 gtip:['certificateConfirmed','upliftConfirmed','tariffConfirmed','preferentialOrigin','documentConfirmed'],
 origin:['tariffConfirmed','preferentialOrigin','documentConfirmed'],
 dispatch:['tariffConfirmed','preferentialOrigin','documentConfirmed'],
 proof:['tariffConfirmed','preferentialOrigin','documentConfirmed'],
 date:['certificateConfirmed','upliftConfirmed','tariffConfirmed','documentConfirmed'],
 grossKg:['certificateConfirmed','upliftConfirmed'],
 quantity:['certificateConfirmed','upliftConfirmed'],
 currency:['upliftConfirmed'],basis:['upliftConfirmed'],invoice:['upliftConfirmed'],freight:['upliftConfirmed'],insurance:['upliftConfirmed'],adjustments:['upliftConfirmed'],
 payment:['paymentReviewed'],gvGroup:['tariffConfirmed'],igvGroup:['tariffConfirmed','preferentialOrigin']
};
export function updateInput(state,key,value){
 if(state[key]===value)return state;
 const next={...state,[key]:value};
 for(const dependent of DECISION_DEPENDENCIES[key]||[]) next[dependent]=false;
 if(key==='gtip')next.productVariant='';
 if(key==='currency'){next.fx=value==='TRY'?'1':'';next.usdFx='';next.declared='';}
 if(key==='fx'&&next.currency==='USD')next.usdFx=value;
 if(key==='tariffMode'){next.tariffConfirmed=false;next.preferentialOrigin=false;next.tariffChoice=value==='guided'?'auto-standard':'unknown';}
 return next;
}
