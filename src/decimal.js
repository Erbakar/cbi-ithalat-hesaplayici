// Six-decimal inputs; integer arithmetic until final currency conversion.
const SCALE=1000000n;
function micro(n){return BigInt(Number(n).toFixed(6).replace('.',''));}
function rounded(n,d){return (n+d/2n)/d;}
function safe(cents){if(cents>100000000000000n)throw new RangeError('Hesap tutarı desteklenen üst sınırı aşıyor.');return Number(cents)/100;}
export function convertMoney(values,fx){return safe(rounded(values.reduce((s,v)=>s+micro(v),0n)*micro(fx)*100n,SCALE*SCALE));}
export function surveillanceMoney(kg,rate,fx){return safe(rounded(micro(kg)*micro(rate)*micro(fx)*100n,1000n*SCALE*SCALE*SCALE));}
export function taxMoney(base,rate){return safe(rounded(micro(base)*micro(rate),SCALE*SCALE));}
export function sumMoney(values){return safe(values.reduce((s,v)=>s+rounded(micro(v)*100n,SCALE),0n));}
export function unitMoney(total,quantity){return safe(rounded(micro(total)*100n,SCALE*BigInt(quantity)));}
