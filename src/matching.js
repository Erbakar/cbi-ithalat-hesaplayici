// Presentation differences are equivalent; semantic differences only suggest candidates.
export const normalizeText=value=>String(value??'').normalize('NFKD').toLocaleLowerCase('tr').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export function normalizeCode(value){const s=String(value??'').normalize('NFKC').trim();return /^[\d\s.,/\-]+$/.test(s)?s.replace(/\D/g,''):'';}
export function editDistance(a,b){const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i?j?0:i:j));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]!==b[j-1]));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);}return d[a.length][b.length];}
export function searchProducts(products,query){
 const q=normalizeText(query).slice(0,160),code=normalizeCode(query);
 if(!q)return products.map(product=>({product,suggested:false,score:0}));
 return products.map(product=>{
  const codes=[product.code,product.surveillanceCorrection?.sourceCode].filter(Boolean).map(normalizeCode);
  if(code){const exact=codes.includes(code),partial=code.length>=4&&codes.some(c=>c.startsWith(code)),near=code.length>=11&&code.length<=13&&codes.some(c=>editDistance(c,code)<=1);return {product,suggested:!exact&&!partial,score:exact?100:partial?80:near?40:0};}
  const label=normalizeText(product.label),text=normalizeText(`${product.label} ${product.context||''} ${(product.searchAliases||[]).join(' ')}`),words=text.split(' '),tokens=q.split(' ');
  const exact=tokens.every(t=>words.some(w=>w.startsWith(t)));
  const near=tokens.every(t=>words.some(w=>w.startsWith(t)||(t.length>=4&&editDistance(t,w)<= (t.length>=8?2:1))));
  return {product,suggested:!exact,score:exact?(label===q?100:tokens.every(t=>label.includes(t))?90:70):near?40:0};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
}
