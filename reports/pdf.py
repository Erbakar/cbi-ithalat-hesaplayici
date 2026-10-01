import sys,json,os
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,Image
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
m=json.load(sys.stdin)
font=os.environ.get('REPORT_FONT','/System/Library/Fonts/Supplemental/Arial.ttf')
if not os.path.exists(font):font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
pdfmetrics.registerFont(TTFont('Report',font))
styles=getSampleStyleSheet()
for n in ['Normal','Title','Heading1','Heading2']:styles[n].fontName='Report';styles[n].textColor=colors.HexColor('#20364f')
styles['Normal'].fontSize=9;styles['Normal'].leading=14
styles['Title'].fontSize=23;styles['Title'].leading=30
styles['Heading2'].fontSize=13;styles['Heading2'].spaceBefore=15
P=lambda s:Paragraph(escape(str(s)),styles['Normal'])
def money(n):return 'Belirlenmedi' if n is None else f'{n:,.2f}'.replace(',','X').replace('.',',').replace('X','.')+' TL'
def table(rows,widths):
 t=Table([[P(c) for c in row] for row in rows],colWidths=widths,hAlign='LEFT',repeatRows=1)
 t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf2f5')),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#dce2e7')),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));return t
story=[]
logo=os.path.join(os.path.dirname(__file__),'../public/assets/cbi-logo-dark.png')
if os.path.exists(logo):story.append(Image(logo,width=76,height=58,kind='proportional',hAlign='LEFT'))
story += [Spacer(1,16),Paragraph('İthalat Maliyet Raporu',styles['Title']),P(('ÖRNEK RAPOR | ' if m['example'] else '')+m['id']+' | '+m['date']),Spacer(1,12),table([['KDV dahil tahmini nakit ihtiyacı',money(m['rows'][7][1])],['Adet başına',money(m['rows'][9][1])]], [320,187]),Paragraph('Sevkiyat bilgileri',styles['Heading2']),table([['Bilgi','Değer']]+m['info'],[150,357]),PageBreak(),Paragraph('Hesap dökümü',styles['Title']),P('Tüm sonuç tutarları Türk lirasıdır.'),Spacer(1,12),table([['Kalem','Tutar (TL)','Açıklama']]+[[a,money(b),c] for a,b,c in m['rows']],[190,115,202]),Paragraph('Kıymet ve matrah ayrımı',styles['Heading2']),table([['Kalem','Tutar (TL)']]+[[a,money(b)] for a,b in m['bases']],[320,187]),PageBreak(),Paragraph('Girdiler ve değerlendirme',styles['Title']),table([['Girilen bedel','Tutar','Para birimi / kapsam']]+[[a,'Dahil' if b is None else str(b),c] for a,b,c in m['inputs']],[220,110,177]),Paragraph('Varsayımlar ve dikkat edilecek noktalar',styles['Heading2'])]
for note in m['notes']:story.extend([P(note),Spacer(1,8)])
story.append(Paragraph('Hesaplama kaynakları',styles['Heading2']))
for source in m['sources']:story.extend([P(source),Spacer(1,5)])
story.extend([P('Veri sürümü: '+m['version']),P('Desteklenen beyan tarihleri: '+m['period'])])
def footer(c,doc):
 c.setFont('Report',8);c.setFillColor(colors.HexColor('#637080'));c.drawString(44,28,'CBI Transportation | '+m['id']);c.drawRightString(551,28,'Sayfa '+str(doc.page))
SimpleDocTemplate(sys.argv[1],pagesize=(595,842),rightMargin=44,leftMargin=44,topMargin=36,bottomMargin=48,title='CBI İthalat Maliyet Raporu',author='CBI Transportation').build(story,onFirstPage=footer,onLaterPages=footer)
