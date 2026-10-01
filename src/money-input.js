export const MONEY_FIELDS=new Set(['invoice','freight','insurance','adjustments','declared','otherTaxes','vatExpenses','outsideExpenses']);
export function readMoney(value){
 if(typeof value==='number')return value;
 const text=String(value).trim();if(!text)return '';
 let raw=text;
 if(text.includes(',')){if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{0,6}$/.test(text))return text;raw=text.replaceAll('.','').replace(',','.');}
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(text))raw=text.replaceAll('.','');
 if(!/^\d+(?:\.\d{0,6})?$/.test(raw))return text;
 return Number(raw);
}
export function displayMoney(value){return typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:6}).format(value):value;}
