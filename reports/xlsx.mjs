import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
let raw='';for await(const chunk of process.stdin)raw+=chunk;const m=JSON.parse(raw);
const wb=Workbook.create(),s=wb.worksheets.add('Hesap dökümü');s.showGridLines=false;
const rows=[['CBI - İthalat hesap dökümü',null,null],[m.id,m.date,m.example?'ÖRNEK RAPOR':'Ön hesap'],['Statik hesap dökümüdür. Değişiklikler için hesaplayıcıdan yeni rapor alın.',null,null],['Kalem','Tutar (TL)','Açıklama'],...m.rows,[],['Kıymet ve matrahlar','Tutar (TL)',null],...m.bases.map(([a,b])=>[a,b,b===null?'Kaynakta belirlenmedi':'']),[],['Sevkiyat bilgileri','Değer',null],...m.info.map(([a,b])=>[a,b,null]),[],['Girilen bedeller','Tutar','Para birimi / kapsam'],...m.inputs,[],['Varsayımlar ve kaynaklar',null,null],...m.notes.map(n=>[n,null,null]),...m.sources.map(n=>[n,null,null]),['Veri sürümü',m.version,null],['Beyan tarihi aralığı',m.period,null]];
s.getRange('A2').write(rows.map(r=>[r[0]??null,r[1]??null,r[2]??null]));
s.getRange(`A2:C${rows.length+1}`).format.font={name:'Arial',size:11,color:'#20364F'};
s.getRange('A1:A90').format.columnWidth=48;s.getRange('B1:B90').format.columnWidth=27;s.getRange('C1:C90').format.columnWidth=55;
s.getRange(`A2:C${rows.length+1}`).format.rowHeight=30;s.getRange(`A2:C${rows.length+1}`).format.wrapText=true;
s.getRange('A2').format.font={name:'Arial',size:16,bold:true};
s.getRange('B6:B15').setNumberFormat('#,##0.00');
for(let i=0;i<rows.length;i++){const r=rows[i],row=i+2;if(typeof r[1]==='number')s.getRange('B'+row).setNumberFormat('#,##0.00');if(['Kalem','Kıymet ve matrahlar','Sevkiyat bilgileri','Girilen bedeller','Varsayımlar ve kaynaklar'].includes(r[0]))s.getRange(`A${row}:C${row}`).format={fill:'#20364F',font:{color:'#FFFFFF',bold:true}};if(r[1]==null&&r[2]==null&&r[0]){s.getRange(`A${row}:C${row}`).merge();s.getRange(`A${row}:C${row}`).format.rowHeight=45;}}
s.getRange('A13:C13').format.fill='#edf5f3';s.freezePanes.freezeRows(5);wb.recalculate();
await (await SpreadsheetFile.exportXlsx(wb)).save(process.argv[2]);
if(process.argv[3])await fs.writeFile(process.argv[3],new Uint8Array(await (await wb.render({sheetName:s.name,range:'A2:C21',scale:1.5})).arrayBuffer()));
