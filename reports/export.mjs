import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReport} from './export-core.mjs';
const root=process.env.CBI_NETLIFY?process.cwd():path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function exportReport(m,format){
 return Buffer.from(await buildReport(m,format,{PDFDocument,ExcelJS,font:path.join(root,'reports/fonts/NotoSans-Regular.ttf'),logo:path.join(root,'public/assets/cbi-logo-dark.png')}));
}
