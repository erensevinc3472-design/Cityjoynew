import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

import os
# Veri şablonlarını (Excel) üretir: python3 scripts/build-data-templates.py
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
provinces=json.load(open(f'{ROOT}/packages/shared/data/locations/provinces.json'))
districts=json.load(open(f'{ROOT}/packages/shared/data/locations/districts.json'))
pname={p['code']:p['name'] for p in provinces}

F='Arial'
H=Font(name=F,bold=True,color='FFFFFF'); HF=PatternFill('solid',fgColor='0B3B47')
REQ=PatternFill('solid',fgColor='FFF2CC')
EX=Font(name=F,italic=True,color='7F7F7F')
N=Font(name=F); B=Font(name=F,bold=True)
thin=Side(style='thin',color='D9D9D9'); BOX=Border(left=thin,right=thin,top=thin,bottom=thin)

wb=Workbook()
ws=wb.active; ws.title='Okuyun'

# Bölümler, sütunlar ve seçenekler tek kaynaktan gelir: packages/shared/data/city-guide-schema.json
# (panel yükleyicisi ve uygulama da aynı dosyayı kullanır).
schema=json.load(open(f'{ROOT}/packages/shared/data/city-guide-schema.json',encoding='utf-8'))
SHEETS=[]
for sec in schema['sections']:
    cols=[(c['key'],c['required'],c['hint']) for c in sec['columns']]
    choices={c['key']:(c['choices'] if c['type']=='choice' else ['Evet','Hayır']) for c in sec['columns'] if c['type'] in ('choice','bool')}
    SHEETS.append((sec['sheet'],sec['description'],cols,choices,sec['example']))

# İlçeler sekmesi (doğrulama listeleri için)
wl=wb.create_sheet('İlçeler')
wl.append(['il_kodu','il','ilce'])
for c in wl[1]: c.font=H; c.fill=HF
for d in districts:
    wl.append([d['provinceCode'],pname[d['provinceCode']],d['name']])
for c in ('A','B','C'): wl.column_dimensions[c].width=18 if c!='A' else 9
wl.freeze_panes='A2'
il_start=2
# İller listesi C sütunu dışında ayrı E sütununa
wl['E1']='iller'; wl['E1'].font=H; wl['E1'].fill=HF
for i,p in enumerate(provinces):
    wl.cell(row=2+i,column=5,value=p['name']).font=N
wl.column_dimensions['E'].width=18
for row in wl.iter_rows(min_row=2,max_col=3):
    for c in row: c.font=N

MAXR=5000
for title,desc,cols,choices,example in SHEETS:
    s=wb.create_sheet(title)
    s.append([c[0] for c in cols])
    for i,(name,req,hint) in enumerate(cols,1):
        cell=s.cell(row=1,column=i); cell.font=H; cell.fill=HF; cell.alignment=Alignment(vertical='center')
        cell.comment=Comment(('ZORUNLU. ' if req else 'İsteğe bağlı. ')+hint,'CityJoy')
        s.column_dimensions[get_column_letter(i)].width=max(14,min(40,len(name)+6))
    s.append(example)
    for c in s[2]: c.font=EX
    # zorunlu sütunların veri alanını hafif sarıyla işaretle (ilk 200 satır)
    for i,(name,req,hint) in enumerate(cols,1):
        col=get_column_letter(i)
        if req:
            for r in range(3,203): s[f'{col}{r}'].fill=REQ
        if name in choices:
            dv=DataValidation(type='list',formula1='"'+','.join(choices[name])+'"',allow_blank=True,showErrorMessage=True,
                              errorTitle='Listeden seçin',error='Bu sütunda yalnızca listedeki değerler kullanılır.')
            s.add_data_validation(dv); dv.add(f'{col}3:{col}{MAXR}')
        if name=='il':
            dv=DataValidation(type='list',formula1="'İlçeler'!$E$2:$E$82",allow_blank=True,showErrorMessage=True,
                              errorTitle='İl adı',error='İl adını listedeki yazımla seçin.')
            s.add_data_validation(dv); dv.add(f'{col}3:{col}{MAXR}')
    s.freeze_panes='A2'
    s.sheet_properties.tabColor='C9A227'

# Okuyun sekmesi
ws.column_dimensions['A'].width=28; ws.column_dimensions['B'].width=110
rows=[
 ('CityJoy · Benim Şehrim sabit bilgi şablonu',None),
 ('Sürüm','1 · 27 Ekim 2026'),
 ('',None),
 ('Nasıl doldurulur',None),
 ('1','Her sekme bir bölümdür. Her satır tek bir yerdir (bir müze, bir otopark, bir pazar...).'),
 ('2','Sütun adlarını ve sırasını değiştirmeyin, sekme adlarını değiştirmeyin. Fazla sütun eklemeyin.'),
 ('3','Her sekmenin 2. satırı gri ÖRNEK satırdır: biçimi gösterir, bilgileri doğrulanmamıştır. Doldururken silin ya da üzerine yazın.'),
 ('4','Sarı alanlar zorunludur. Başlık hücresinin üstüne gelince o sütunun açıklaması görünür.'),
 ('5','İl ve ilçe adlarını "İlçeler" sekmesindeki yazımla yazın (örnek: "Nilüfer", "Merkez"). İl sütununda açılır liste vardır.'),
 ('6','Listeden seçilen sütunlarda (kategori, tür, Evet/Hayır) yalnızca listedeki değerler kullanılır.'),
 ('7','Her satırda KAYNAK zorunludur: bilginin alındığı resmî sayfanın adresi ve bakıldığı gün. Kaynağı olmayan satır yüklenmez.'),
 ('8','Bilinmeyen bilgi boş bırakılır. Tahmin edilmez, uydurulmaz. Özellikle telefon, adres, fiyat ve harita konumu.'),
 ('9','Kişisel veri yazılmaz: kişisel cep telefonu, e-posta, kimlik no. Yalnızca kurumların resmî iletişim bilgileri.'),
 ('10','Siyasi parti adı, kişi övgüsü, reklam yazılmaz (tarafsızlık ilkesi).'),
 ('11','Metinler Türkçe yazılır; diğer dillere çeviri sonra yapılır.'),
 ('12','Bir il için tek dosya ya da birçok il bir arada olabilir. Dosya adı örneği: benim-sehrim-bursa.xlsx'),
 ('',None),
 ('Yüklendikten sonra',None),
 ('•','Dosya panelden yüklenir; hatalı satırlar yüklemeden önce listelenir.'),
 ('•','Yüklenen bilgiler uygulamada "doğrulanmadı" işaretiyle ve kaynağıyla görünür; il yöneticisi, belediye ya da CityJoy ekibi doğruladıkça işaret kalkar.'),
 ('•','Kafe-restoran ve işletmeler bu şablona girmez: İşletmem bölümünden gelir. Nöbetçi eczane ve etkinlikler de ayrıdır.'),
 ('',None),
 ('Başka bir yapay zekâya verilecek metin',None),
 ('Metin',"Ekteki Excel şablonunu [İL ADI] ili için doldur. Kurallar: (1) Sütun adlarını, sırasını ve sekme adlarını değiştirme. (2) Her satır tek bir yer olsun. (3) Yalnızca gerçekten var olan ve resmî ya da güvenilir bir kaynakta yayımlanmış bilgileri yaz; her satıra 'kaynak' sütununa o bilginin bulunduğu sayfanın tam adresini, 'kaynak_tarihi' sütununa bugünün tarihini yaz. (4) Emin olmadığın hiçbir bilgiyi tahmin etme veya uydurma; telefon, adres, fiyat, saat ve harita konumunu bilmiyorsan boş bırak. (5) Kişisel telefon, kişisel e-posta yazma; yalnızca kurumların resmî iletişim bilgileri. (6) Liste sütunlarında (kategori, tur, Evet/Hayır) yalnızca açıklamadaki değerleri kullan. (7) İl ve ilçe adlarını 'İlçeler' sekmesindeki yazımla yaz. (8) Siyasi parti adı, övgü ve reklam yazma. (9) Gri örnek satırları sil. Sonuç olarak aynı biçimde .xlsx dosyası ver."),
 ('Uyarı','Yapay zekâ araçları bazen var olmayan yerler, yanlış telefon ya da adres üretebilir. Bu yüzden kaynak sütunu zorunlu; kaynağı açılmayan ya da tutmayan satırlar yüklenmeden ayıklanır.'),
 ('',None),
 ('Sekmeler',None),
]+[(t,d) for t,d,_,_,_ in SHEETS]+[('İlçeler','81 il ve 973 ilçenin doğru yazımı (PTT listesinden). Değiştirmeyin.')]
for a,b in rows:
    ws.append([a,b])
    r=ws.max_row
    ws.cell(r,1).font=N; ws.cell(r,2).font=N
    ws.cell(r,2).alignment=Alignment(wrap_text=True,vertical='top'); ws.cell(r,1).alignment=Alignment(vertical='top')
    if b is None and a:
        ws.cell(r,1).font=Font(name=F,bold=True,size=14 if r==1 else 12,color='0B3B47')
ws.sheet_properties.tabColor='0B3B47'
# İlçeler sekmesini sona taşı
wb.move_sheet('İlçeler', offset=len(wb.sheetnames))
out=f'{ROOT}/docs/veri-sablonlari/benim-sehrim-sablon.xlsx'
wb.save(out); print(out, wb.sheetnames)
