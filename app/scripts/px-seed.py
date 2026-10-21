# Mashq zali savollari (liga_px_bank, liga_px_acc) uchun SQL: python3 app/scripts/px-seed.py > db/2026-10-21b_mashq_savollar.sql  (repo ildizidan)
import json
su=json.load(open('app/src/data/stages.uz.json'));sr=json.load(open('app/src/data/stages.ru.json'))
acc=json.load(open('app/src/data/accounts.uz.json'));accr=json.load(open('app/src/data/accounts.ru.json'))
q=lambda s:"'"+s.replace("'","''")+"'"
rows=[]
i=0
for x,y in zip(su,sr):
  for t,u in zip(x['tasks'],y['tasks']):
    if t['t']!='pv': continue
    i+=1
    o="array["+",".join(q(c) for c in t['o'])+"]"
    rows.append(f"({i},{q(t['q'])},{q(u['q'])},{q(t['dt'])},{q(t['kt'])},{o},{q(t['e'])},{q(u['e'])})")
A=set("0130 0820 1010 2010 2510 2810 2910 4010 4220 4230 4310 4410 4610 4730 4860 5010 5110 5210 5910".split())
R=set("9010 9020 9030 9310 9330 9390 9540".split()); X=set("9110 9120 9410 9420 9430 9610 9620 9810".split()); E=set("8330 8530 8710".split())
def side(c):
  if c in A: return 'a'
  if c in E: return 'e'
  if c in R: return 'r'
  if c in X: return 'x'
  if c[0] in '67': return 'l'
  return 'n'
ac=",\n".join(f"({q(c)},{q(side(c))},{q(acc[c])},{q(accr[c])})" for c in sorted(acc))
print("insert into public.liga_px_bank(id,q_uz,q_ru,dt,kt,o,e_uz,e_ru) values\n"+",\n".join(rows)+"\non conflict (id) do update set q_uz=excluded.q_uz,q_ru=excluded.q_ru,dt=excluded.dt,kt=excluded.kt,o=excluded.o,e_uz=excluded.e_uz,e_ru=excluded.e_ru;")
print("insert into public.liga_px_acc(code,side,name_uz,name_ru) values\n"+ac+"\non conflict (code) do update set side=excluded.side,name_uz=excluded.name_uz,name_ru=excluded.name_ru;")
