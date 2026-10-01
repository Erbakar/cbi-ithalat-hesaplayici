import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.env.CBI_NETLIFY?process.cwd():path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const money=n=>n==null?'Belirlenmedi':new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' TL';
export async function exportReport(m,format){
 if(format==='xlsx'){
  const wb=new ExcelJS.Workbook();wb.creator='CBI Transportation';const s=wb.addWorksheet('Hesap dökümü',{views:[{state:'frozen',ySplit:4}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  s.columns=[{width:46},{width:28},{width:65}];
  const rows=[['CBI · İthalat hesap dökümü'],[m.id,m.date,m.example?'ÖRNEK RAPOR':'Ön hesap'],['Statik hesap dökümüdür. Değişiklikler için yeni rapor alın.'],['Kalem','Tutar (TL)','Açıklama'],...m.rows,[],['Kıymet ve matrahlar','Tutar (TL)'],...m.bases,[],['Sevkiyat bilgileri','Değer'],...m.info,[],['Girilen bedeller','Tutar','Para birimi / kapsam'],...m.inputs,[],['Varsayımlar ve kaynaklar'],...m.notes.map(n=>[n]),...m.sources.map(n=>[n]),['Veri sürümü',m.version],['Beyan tarihi aralığı',m.period]];
  for(const values of rows){const r=s.addRow(values);r.font={name:'Arial',size:11,color:{argb:'FF20364F'}};r.alignment={vertical:'top',wrapText:true};r.height=34;r.eachCell(c=>{if(typeof c.value==='number')c.numFmt='#,##0.00';});if(values.length===1){s.mergeCells(r.number,1,r.number,3);r.height=Math.max(36,Math.ceil(String(values[0]).length/120)*17+12);}if(['Kalem','Kıymet ve matrahlar','Sevkiyat bilgileri','Girilen bedeller','Varsayımlar ve kaynaklar'].includes(values[0])){r.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF20364F'}};r.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};}if(values[0]==='Toplam nakit ihtiyacı'){r.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDF5F3'}};r.font={name:'Arial',bold:true,size:12};}}
  s.getRow(1).font={name:'Arial',size:18,bold:true,color:{argb:'FF20364F'}};return Buffer.from(await wb.xlsx.writeBuffer());
 }
 const doc=new PDFDocument({size:'A4',margin:44,bufferPages:true,info:{Title:'CBI İthalat Maliyet Raporu',Author:'CBI Transportation'}}),chunks=[];
 const done=new Promise((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.registerFont('Report',path.join(root,'reports/fonts/NotoSans-Regular.ttf')).font('Report');
 const title=t=>{doc.fontSize(22).fillColor('#20364f').text(t);doc.moveDown(.5);};
 const paragraph=t=>{doc.fontSize(9).fillColor('#20364f').text(String(t),{lineGap:4});doc.moveDown(.6);};
 const table=(rows,widths)=>{for(let i=0;i<rows.length;i++){doc.fontSize(9);const heights=rows[i].map((v,j)=>doc.heightOfString(String(v??''),{width:widths[j]-14,lineGap:3}));const h=Math.max(...heights)+16;if(doc.y+h>785){doc.addPage();}const y=doc.y;let x=44;if(i===0)doc.rect(44,y,507,h).fill('#edf2f5');for(let j=0;j<widths.length;j++){doc.fillColor('#20364f').text(String(rows[i][j]??''),x+7,y+8,{width:widths[j]-14,lineGap:3});x+=widths[j];}doc.moveTo(44,y+h).lineTo(551,y+h).strokeColor('#dce2e7').lineWidth(.4).stroke();doc.x=44;doc.y=y+h;}doc.moveDown(.7);};
 doc.image(path.join(root,'public/assets/cbi-logo-dark.png'),44,36,{fit:[76,58]});doc.y=110;title('İthalat Maliyet Raporu');paragraph((m.example?'ÖRNEK RAPOR | ':'')+m.id+' | '+m.date);
 table([['KDV dahil tahmini nakit ihtiyacı',money(m.rows[7][1])],['Adet başına',money(m.rows[9][1])]],[320,187]);
 paragraph('Sevkiyat bilgileri');table([['Bilgi','Değer'],...m.info],[150,357]);
 doc.addPage();title('Hesap dökümü');paragraph('Tüm sonuç tutarları Türk lirasıdır.');table([['Kalem','Tutar (TL)','Açıklama'],...m.rows.map(([a,b,c])=>[a,money(b),c])],[190,115,202]);paragraph('Kıymet ve matrah ayrımı');table([['Kalem','Tutar (TL)'],...m.bases.map(([a,b])=>[a,money(b)])],[320,187]);
 doc.addPage();title('Girdiler ve değerlendirme');table([['Girilen bedel','Tutar','Para birimi / kapsam'],...m.inputs.map(([a,b,c])=>[a,b==null?'Dahil':new Intl.NumberFormat('tr-TR').format(b),c])],[220,110,177]);paragraph('Varsayımlar ve dikkat edilecek noktalar');m.notes.forEach(paragraph);paragraph('Hesaplama kaynakları');m.sources.forEach(paragraph);paragraph('Veri sürümü: '+m.version);paragraph('Desteklenen beyan tarihleri: '+m.period);
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.fontSize(8).fillColor('#637080').text('CBI Transportation | '+m.id,44,810,{lineBreak:false});doc.text('Sayfa '+(i+1),495,810,{lineBreak:false});}doc.end();return done;
}
