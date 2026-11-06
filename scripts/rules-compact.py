# Firestore kurallarını küçültür (Firebase sınırı: derlenmiş boyut 256.000 bayt).
# "allow create/update: if ..." içinde request.resource.data 2+ kez geçiyorsa ifade bir işleve taşınır ve
# request.resource.data -> nw, resource.data -> od olur. İşlev argümanları tembel değerlendirilir (emülatörde denendi:
# kayıt yokken resource.data argümanı, kullanılmadıkça hata vermez), bu yüzden davranış aynı kalır.
# Kullanım: python3 scripts/rules-compact.py girdi.rules cikti.rules   (sonra npm run test:rules)
import re,sys
src=open(sys.argv[1]).read()
out=[];n=0;stat=[0,0]
pat=re.compile(r'^([ \t]*)allow ([a-z, ]+):\s*if\s',re.M)
NEW='request.resource.data'
OLD=re.compile(r'(?<![\w.])resource\.data(?![\w])')
pos=0
while True:
    m=pat.search(src,pos)
    if not m: out.append(src[pos:]);break
    ops=set(o.strip() for o in m.group(2).split(','))
    j=m.end();depth=0
    while True:
        c=src[j]
        if src.startswith('//',j): j=src.index('\n',j);continue
        if c in "'\"":
            k=j+1
            while src[k]!=c: k+= 2 if src[k]=='\\' else 1
            j=k+1;continue
        if c in '([{': depth+=1
        elif c in ')]}': depth-=1
        elif c==';' and depth==0: break
        j+=1
    expr=src[m.end():j]
    assert not re.search(r'\b(nw|od)\b',expr)
    cn=expr.count(NEW)
    body=expr.replace(NEW,'nw') if cn>=2 else expr
    useN = body is not expr
    co=len(OLD.findall(body))
    useO = co>=2
    if useO: body=OLD.sub('od',body)
    if useN or useO:
        n+=1;ind=m.group(1);fname='_k%d'%n
        params=[p for p,u in (('nw',useN),('od',useO)) if u]
        args=[a for a,u in ((NEW,useN),('resource.data',useO)) if u]
        out.append(src[pos:m.start()])
        out.append('%sfunction %s(%s) {\n%s  return %s;\n%s}\n'%(ind,fname,', '.join(params),ind,body.strip(),ind))
        out.append('%sallow %s: if %s(%s)'%(ind,m.group(2),fname,', '.join(args)))
        pos=j;stat[0]+=cn if useN else 0;stat[1]+=co if useO else 0
    else:
        out.append(src[pos:m.end()]);pos=m.end()
open(sys.argv[2],'w').write(''.join(out))
print('fonksiyon',n,'yeni',stat[0],'eski',stat[1],file=sys.stderr)
