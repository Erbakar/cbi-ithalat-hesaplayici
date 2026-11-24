import {calculate} from './engine.js';
import {resolveTariff} from './rules.js';
import {STEP_KEYS as TOY_STEP_KEYS} from './guidance.js';
import {MODEL as DESTINATION_MODEL,STEP_KEYS as DESTINATION_STEP_KEYS,destinationWorkflowErrors} from './destination.js';
export const stepKeysFor=catalog=>catalog?.model===DESTINATION_MODEL?DESTINATION_STEP_KEYS:TOY_STEP_KEYS;
export function workflowErrors(input,catalog){
 if(catalog?.model===DESTINATION_MODEL)return destinationWorkflowErrors(input,catalog);
 const errors={...calculate(input,catalog).errors};
 for(const key of ['origin','dispatch'])if(input[key]==='Bilmiyorum')errors[key]='Devam etmek için ülkeyi öğrenip listeden seçin.';
 if(input.proof==='unknown')errors.proof='Belge durumunu tedarikçinizle netleştirin. Belge yoksa “Bu belgelerden hiçbiri yok” seçin.';
 if(!resolveTariff(input,catalog.tariffPolicy).resolved)errors.tariffChoice='Bir hesaplama yolu seçin: açıkça genel tarife karşılaştırması veya müşavir tarafından teyit edilmiş oranlar.';
 if(input.scenario==='unknown')errors.scenario='Hesaplama için beyan senaryosunu seçin.';
 if(input.tariffMode==='guided'&&input.payment==='unknown')errors.payment='Ödeme şeklini öğrenip seçin.';
 if(input.tariffMode==='guided'&&input.payment==='deferred'&&input.paymentReviewed!==true)errors.paymentReviewed='Vadeli ödemenin fon / vergi kontrolünü tamamlayın.';
 for(const key of ['otherTaxes','vatExpenses','outsideExpenses'])if(input[key]===''||input[key]==null)errors[key]='Tutarı girin. Bu gider gerçekten yoksa “Yok · 0 TL” seçin.';
 if(input.currency==='USD'&&errors.usdFx){errors.fx=errors.fx||errors.usdFx;delete errors.usdFx;}
 return errors;
}
export function validateThroughStep(input,catalog,step){
 const errors=workflowErrors(input,catalog),keys=stepKeysFor(catalog);
 for(let i=0;i<=step;i++){const fields=Object.fromEntries(Object.entries(errors).filter(([key])=>keys[i].includes(key)));if(Object.keys(fields).length)return {ok:false,step:i,errors:fields};}
 return {ok:true,step,errors:{}};
}
