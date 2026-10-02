// @ts-nocheck
/* avtomatik: topics.uz.src.js dan */
export function buildTopics(A: Record<string,string>, fmt: (n:number)=>string){
/* ---------------- yo'nalishlar: mavzular bo'yicha savollar bazasi ----------------
   Savollar barqaror (bir xil urug' — har safar bir xil savollar), stavkalar savol matnida aytiladi. */
function srng(seed){ let a=seed>>>0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hstr(s){ let h=2166136261; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
const TOPICS=(function(){
  const ri=(R,a,b)=>a+Math.floor(R()*(b-a+1)), pick=(R,a)=>a[Math.floor(R()*a.length)], N=n=>fmt(n);
  const AK=Object.keys(A);
  const pv=(R,q,dt,kt,e)=>{ const o=[dt,kt]; while(o.length<4){ const c=pick(R,AK); if(!o.includes(c)) o.push(c); } return {t:"pv",q,dt,kt,o,e}; };
  const calc=(q,a,e)=>({t:"calc",q,a:Math.round(a),e});
  const mc=(q,o,e)=>({t:"mc",q,o,a:0,e});            // to'g'ri javob — birinchi variant (ekranda aralashtiriladi)
  const M=(R,a,b)=>ri(R,a,b)*1000000, K=(R,a,b)=>ri(R,a,b)*100000;
  const T={
  qqs:{icon:"🧾",title:"QQS",n:40,tpl:[
    R=>{const x=K(R,5,400),a=x*12/100; return calc(`Tovarning QQSsiz qiymati ${N(x)} so'm. QQS stavkasi 12%. QQS summasi qancha?`,a,`${N(x)} × 12% = ${N(a)} so'm.`);},
    R=>{const x=K(R,5,300),y=x*112/100,a=x*12/100; return calc(`Hisobvaraq-fakturada jami summa (QQS bilan) ${N(y)} so'm, QQS 12%. Fakturadagi QQS summasi?`,a,`QQS = jami × 12 ÷ 112 = ${N(y)} × 12 ÷ 112 = ${N(a)} so'm.`);},
    R=>{const o=M(R,20,150),i=M(R,5,o/1e6-5); return calc(`Oy davomida sotishdan hisoblangan QQS ${N(o)} so'm, hisobga olinadigan kirim QQS ${N(i)} so'm. Budjetga to'lanadigan QQS?`,o-i,`To'lanadigan QQS = hisoblangan − kirim QQS = ${N(o)} − ${N(i)} = ${N(o-i)} so'm.`);},
    R=>{const x=K(R,5,300),a=x*112/100; return calc(`Xizmat qiymati QQSsiz ${N(x)} so'm, QQS 12%. Xaridor to'laydigan jami summa?`,a,`${N(x)} + 12% = ${N(x)} × 1,12 = ${N(a)} so'm.`);},
    R=>{const e=M(R,50,500),d=M(R,20,300),a=d*12/100; return calc(`Oyda eksport ${N(e)} so'm (0% stavka) va ichki bozorda sotish ${N(d)} so'm (QQSsiz, stavka 12%). Hisoblangan QQS jami?`,a,`Eksportga 0%, faqat ichki sotuvga 12%: ${N(d)} × 12% = ${N(a)} so'm.`);},
    R=>{const s=ri(R,10,50)*10000000,p=pick(R,[50,60,75,80]),t=s*p/100,f=s-t,i=M(R,5,40),a=i*p/100;
      return calc(`Oyda QQS solinadigan sotish ${N(t)} so'm, QQSdan ozod sotish ${N(f)} so'm. Kirim QQS ${N(i)} so'm. Masala sharti: kirim QQS sotish ulushiga mutanosib hisobga olinadi. Hisobga olinadigan kirim QQS?`,a,`Ulush = ${N(t)} ÷ ${N(s)} = ${p}%. ${N(i)} × ${p}% = ${N(a)} so'm.`);},
    R=>pv(R,`Yetkazib beruvchi fakturasidagi kirim QQS — ${N(K(R,2,90))} so'm — aks ettirildi.`,"4410","6010","Kirim QQS budjetga bo'nak sifatida (Dt 4410), yetkazib beruvchiga qarz shu summaga oshadi (Kt 6010)."),
    R=>pv(R,`Xaridorga sotilgan tovar bo'yicha ${N(K(R,2,90))} so'm QQS hisoblandi.`,"4010","6410","Xaridor QQSni ham to'laydi (Dt 4010), budjetga qarz paydo bo'ladi (Kt 6410)."),
    R=>pv(R,`Oy yakunida ${N(K(R,2,90))} so'm kirim QQS budjetga qarzdan chegirildi.`,"6410","4410","Budjetga qarz kamayadi (Dt 6410), kirim QQS bo'nagi yopiladi (Kt 4410)."),
    R=>pv(R,`QQS bo'yicha ${N(K(R,5,150))} so'm qarz bank orqali budjetga to'landi.`,"6410","5110","Budjetga qarz kamayadi (Dt 6410), bank hisobi kamayadi (Kt 5110).")]},
  ish:{icon:"💼",title:"Ish haqi",n:40,tpl:[
    R=>{const x=K(R,30,200),a=x*88/100; return calc(`Xodimga ${N(x)} so'm ish haqi hisoblandi. JShDS 12% ushlanadi. Qo'lga beriladigan summa?`,a,`${N(x)} − 12% = ${N(x)} × 0,88 = ${N(a)} so'm.`);},
    R=>{const x=M(R,20,500),a=x*12/100; return calc(`Oylik ish haqi fondi ${N(x)} so'm. Ijtimoiy soliq 12%. Ijtimoiy soliq summasi?`,a,`${N(x)} × 12% = ${N(a)} so'm. Ijtimoiy soliq xodimdan ushlanmaydi — firma o'zi to'laydi.`);},
    R=>{const x=K(R,30,150),p=pick(R,[10,20,25,30,40,50]),a=x+x*p/100; return calc(`Xodimning okladi ${N(x)} so'm, mukofot okladning ${p}%. Jami hisoblangan ish haqi?`,a,`${N(x)} + ${p}% (${N(x*p/100)}) = ${N(a)} so'm.`);},
    R=>{const x=22*ri(R,15,90)*10000,d=ri(R,8,21),a=x/22*d; return calc(`Okladi ${N(x)} so'm, oyda 22 ish kuni. Xodim ${d} kun ishladi. Hisoblangan ish haqi?`,a,`${N(x)} ÷ 22 × ${d} = ${N(a)} so'm.`);},
    R=>{const x=K(R,40,200),z=K(R,2,10),a=x*88/100-z; return calc(`Ish haqi ${N(x)} so'm, JShDS 12%, ijro varaqasi bo'yicha ushlanma ${N(z)} so'm. Qo'lga beriladigan summa?`,a,`${N(x)} − ${N(x*12/100)} (JShDS) − ${N(z)} = ${N(a)} so'm.`);},
    R=>{const d=ri(R,150,900)*1000,n=pick(R,[15,21,24,30]),a=d*n; return calc(`Xodimning o'rtacha kunlik ish haqi ${N(d)} so'm. Ta'til ${n} kalendar kun. Ta'til puli?`,a,`${N(d)} × ${n} = ${N(a)} so'm.`);},
    R=>{const x=M(R,20,400),a=x*112/100; return calc(`Ish haqi fondi ${N(x)} so'm. Ijtimoiy soliq 12% bilan firmaning ish haqi bo'yicha jami xarajati?`,a,`${N(x)} + 12% = ${N(a)} so'm.`);},
    R=>pv(R,`Ishlab chiqarish ishchilariga ${N(K(R,50,900))} so'm ish haqi hisoblandi.`,"2010","6710","Ishchilar ish haqi mahsulot tannarxiga kiradi (Dt 2010), xodimlarga qarz (Kt 6710)."),
    R=>pv(R,`Ma'muriyat xodimlariga ${N(K(R,50,900))} so'm ish haqi hisoblandi.`,"9420","6710","Ma'muriyat ish haqi — davr xarajati (Dt 9420), xodimlarga qarz (Kt 6710)."),
    R=>pv(R,`Sotish bo'limi xodimlariga ${N(K(R,50,900))} so'm ish haqi hisoblandi.`,"9410","6710","Sotish bo'limi ish haqi — sotish xarajati (Dt 9410), xodimlarga qarz (Kt 6710)."),
    R=>pv(R,`Ish haqidan ${N(K(R,5,90))} so'm JShDS ushlandi.`,"6710","6410","Xodimga qarz kamayadi (Dt 6710), budjetga qarz oshadi (Kt 6410)."),
    R=>pv(R,`${N(K(R,30,900))} so'm ish haqi xodimlarning bank kartalariga o'tkazildi.`,"6710","5110","Xodimlarga qarz yopiladi (Dt 6710), bank hisobi kamayadi (Kt 5110)."),
    R=>pv(R,`Kassadan ${N(K(R,10,90))} so'm ish haqi naqd berildi.`,"6710","5010","Xodimlarga qarz yopiladi (Dt 6710), kassa kamayadi (Kt 5010)."),
    R=>pv(R,`Xodim yetkazgan ${N(K(R,1,20))} so'm moddiy zarar uning ish haqidan ushlandi.`,"6710","4730","Ish haqi qarzi kamayadi (Dt 6710), xodimning moddiy zarar qarzi yopiladi (Kt 4730).")]},
  av:{icon:"🏭",title:"Asosiy vositalar",n:40,tpl:[
    R=>{const n=pick(R,[4,5,8,10]),l=M(R,0,5),x=l+n*M(R,2,40),a=(x-l)/n; return calc(`Uskunaning boshlang'ich qiymati ${N(x)} so'm, tugatish qiymati ${N(l)} so'm, foydali xizmat muddati ${n} yil. To'g'ri chiziqli usulda YILLIK amortizatsiya?`,a,`(${N(x)} − ${N(l)}) ÷ ${n} = ${N(a)} so'm.`);},
    R=>{const n=pick(R,[2,3,4,5]),l=K(R,0,20),x=l+n*12*K(R,1,30),a=(x-l)/(n*12); return calc(`Kompyuter qiymati ${N(x)} so'm, tugatish qiymati ${N(l)} so'm, xizmat muddati ${n} yil. To'g'ri chiziqli usulda OYLIK amortizatsiya?`,a,`(${N(x)} − ${N(l)}) ÷ (${n} × 12) = ${N(a)} so'm.`);},
    R=>{const x=M(R,50,500),y=M(R,5,x/1e6-10); return calc(`Bino boshlang'ich qiymati ${N(x)} so'm, to'plangan eskirish ${N(y)} so'm. Qoldiq (balans) qiymati?`,x-y,`${N(x)} − ${N(y)} = ${N(x-y)} so'm.`);},
    R=>{const b=M(R,10,200),s=b+M(R,1,50); return calc(`Qoldiq qiymati ${N(b)} so'm bo'lgan uskuna ${N(s)} so'mga (QQSsiz) sotildi. Chiqib ketishdan foyda?`,s-b,`Sotish qiymati − qoldiq qiymat = ${N(s)} − ${N(b)} = ${N(s-b)} so'm.`);},
    R=>{const n=pick(R,[4,5,8,10]),k=ri(R,5,50),x=n*k*1e6,a=x*2/n; return calc(`Avtomobil qiymati ${N(x)} so'm, xizmat muddati ${n} yil, tugatish qiymati 0. Ikki baravar kamayuvchi qoldiq usulida 1-YIL amortizatsiyasi?`,a,`Stavka = 2 ÷ ${n} = ${Math.round(200/n)}%. ${N(x)} × 2 ÷ ${n} = ${N(a)} so'm.`);},
    R=>{const u=pick(R,[10000,20000,50000,100000]),k=ri(R,50,500),x=u*k,v=ri(R,1000,u/2); return calc(`Stanok qiymati ${N(x)} so'm, butun xizmat davrida ${N(u)} dona mahsulot chiqaradi. Bu yil ${N(v)} dona chiqardi. Ishlab chiqarish hajmi usulida amortizatsiya?`,k*v,`1 donaga: ${N(x)} ÷ ${N(u)} = ${k} so'm. ${k} × ${N(v)} = ${N(k*v)} so'm.`);},
    R=>{const p=M(R,20,300),t=K(R,5,50),m=K(R,5,80); return calc(`Uskuna narxi ${N(p)} so'm (QQSsiz), yetkazib berish ${N(t)} so'm, o'rnatish va sozlash ${N(m)} so'm. Kirim QQS hisobga olinadi. Boshlang'ich qiymat?`,p+t+m,`Foydalanishga tayyorlashgacha bo'lgan barcha xarajatlar: ${N(p)} + ${N(t)} + ${N(m)} = ${N(p+t+m)} so'm.`);},
    R=>pv(R,`Yetkazib beruvchidan ${N(M(R,10,300))} so'mlik uskuna olindi (QQSsiz).`,"0820","6010","Hali foydalanishga topshirilmagan uskuna — kapital qo'yilma (Dt 0820), yetkazib beruvchiga qarz (Kt 6010)."),
    R=>pv(R,`${N(M(R,10,300))} so'mlik uskuna foydalanishga topshirildi.`,"0130","0820","Asosiy vosita tan olinadi (Dt 0130), kapital qo'yilma yopiladi (Kt 0820)."),
    R=>pv(R,`Sex uskunasiga ${N(K(R,5,90))} so'm amortizatsiya hisoblandi.`,"2010","0230","Sex uskunasi eskirishi mahsulot tannarxiga (Dt 2010), to'plangan eskirish oshadi (Kt 0230)."),
    R=>pv(R,`Ofis kompyuterlariga ${N(K(R,2,40))} so'm amortizatsiya hisoblandi.`,"9420","0230","Ofis jihozlari eskirishi — ma'muriy xarajat (Dt 9420), to'plangan eskirish (Kt 0230)."),
    R=>pv(R,`Chiqib ketgan uskunaning ${N(M(R,5,90))} so'm to'plangan eskirishi hisobdan chiqarildi.`,"0230","0130","Eskirish yopiladi (Dt 0230), asosiy vosita qiymati kamayadi (Kt 0130)."),
    R=>pv(R,`Chiqib ketgan uskunaning ${N(M(R,5,90))} so'm qoldiq qiymati hisobdan chiqarildi.`,"9210","0130","Qoldiq qiymat chiqib ketish hisobvarag'iga (Dt 9210), asosiy vosita kamayadi (Kt 0130).")]},
  tmz:{icon:"📦",title:"Zaxiralar",n:40,tpl:[
    R=>{const a=ri(R,10,50),p1=ri(R,10,50)*1000,b=ri(R,10,60),p2=p1+ri(R,1,10)*1000,c=ri(R,a+1,a+b),v=a*p1+(c-a)*p2;
      return calc(`Oy boshida ${a} dona × ${N(p1)} so'm qoldiq, keyin ${b} dona × ${N(p2)} so'mdan kirim. ${c} dona chiqim qilindi. FIFO usulida chiqim tannarxi?`,v,`Avval eski partiya: ${a} × ${N(p1)} = ${N(a*p1)}; qolgani ${c-a} × ${N(p2)} = ${N((c-a)*p2)}. Jami ${N(v)} so'm.`);},
    R=>{const a=ri(R,10,40),m=ri(R,10,60)*1000,d=ri(R,1,9)*1000,c=ri(R,5,2*a),v=c*m;
      return calc(`Qoldiq ${a} dona × ${N(m-d)} so'm, kirim ${a} dona × ${N(m+d)} so'm. ${c} dona chiqim. O'rtacha tortilgan tannarx usulida chiqim summasi?`,v,`O'rtacha narx = (${N(a*(m-d))} + ${N(a*(m+d))}) ÷ ${2*a} = ${N(m)}. ${c} × ${N(m)} = ${N(v)} so'm.`);},
    R=>{const p=M(R,10,200),t=K(R,2,40),b=K(R,2,60); return calc(`Material narxi ${N(p)} so'm (QQSsiz), transport ${N(t)} so'm, bojxona to'lovlari ${N(b)} so'm. Kirim QQS hisobga olinadi. Materialning haqiqiy tannarxi?`,p+t+b,`Xarid bilan bog'liq barcha xarajatlar: ${N(p)} + ${N(t)} + ${N(b)} = ${N(p+t+b)} so'm.`);},
    R=>{const q1=ri(R,100,500),q2=q1-ri(R,3,30),p=ri(R,5,90)*1000; return calc(`Inventarizatsiya: hisob bo'yicha ${q1} dona, haqiqatda ${q2} dona. 1 dona tannarxi ${N(p)} so'm. Kamomad summasi?`,(q1-q2)*p,`(${q1} − ${q2}) × ${N(p)} = ${N((q1-q2)*p)} so'm.`);},
    R=>{const s=M(R,10,90),k=M(R,20,150),c=M(R,10,(s+k)/1e6-5); return calc(`1010: oy boshi qoldig'i ${N(s)} so'm, oyda kirim ${N(k)} so'm, ishlab chiqarishga berildi ${N(c)} so'm. Oy oxiri qoldig'i?`,s+k-c,`Aktiv hisobvaraq: ${N(s)} + ${N(k)} − ${N(c)} = ${N(s+k-c)} so'm.`);},
    R=>{const x=M(R,20,200),y=x-M(R,1,15); return calc(`Tovar tannarxi ${N(x)} so'm, sof sotish qiymati ${N(y)} so'm. MHXS (IAS 2) bo'yicha qadrsizlanish summasi?`,x-y,`Zaxira tannarx va sof sotish qiymatining kichigida baholanadi: ${N(x)} − ${N(y)} = ${N(x-y)} so'm.`);},
    R=>pv(R,`Yetkazib beruvchidan ${N(M(R,2,90))} so'mlik materiallar kirim qilindi.`,"1010","6010","Materiallar ko'paydi (Dt 1010), yetkazib beruvchiga qarz (Kt 6010)."),
    R=>pv(R,`${N(M(R,2,90))} so'mlik materiallar asosiy ishlab chiqarishga berildi.`,"2010","1010","Ishlab chiqarish xarajati (Dt 2010), ombordagi material kamayadi (Kt 1010)."),
    R=>pv(R,`Ofis ehtiyojlari uchun ${N(K(R,2,40))} so'mlik kanselyariya hisobdan chiqarildi.`,"9420","1010","Ofis ehtiyoji — ma'muriy xarajat (Dt 9420), material kamayadi (Kt 1010)."),
    R=>pv(R,`Inventarizatsiyada ${N(K(R,2,40))} so'mlik materiallar kamomadi aniqlandi.`,"5910","1010","Kamomad avval 5910 ga yig'iladi (Dt 5910), material kamayadi (Kt 1010)."),
    R=>pv(R,`${N(K(R,2,40))} so'mlik kamomad aybdor xodim zimmasiga yuklandi.`,"4730","5910","Xodim qarzi (Dt 4730), kamomad hisobvarag'i yopiladi (Kt 5910)."),
    R=>pv(R,`Sotish uchun ${N(M(R,5,150))} so'mlik tovarlar kirim qilindi.`,"2910","6010","Tovarlar ko'paydi (Dt 2910), yetkazib beruvchiga qarz (Kt 6010)."),
    R=>pv(R,`Sotilgan tovarlarning ${N(M(R,5,150))} so'm tannarxi hisobdan chiqarildi.`,"9120","2910","Sotilgan tovar tannarxi (Dt 9120), ombordagi tovar kamayadi (Kt 2910)."),
    R=>pv(R,`Ishlab chiqarishdan ${N(M(R,5,150))} so'mlik tayyor mahsulot omborga kirim qilindi.`,"2810","2010","Tayyor mahsulot (Dt 2810), ishlab chiqarish xarajati yopiladi (Kt 2010)."),
    R=>pv(R,`Inventarizatsiyada ${N(K(R,2,40))} so'mlik materiallar ortiqchasi aniqlandi.`,"1010","9390","Ortiqcha material kirim qilinadi (Dt 1010) — boshqa operatsion daromad (Kt 9390).")]},
  sol:{icon:"🏛️",title:"Soliqlar",n:40,tpl:[
    R=>{const x=K(R,50,5000),a=x*15/100; return calc(`Soliq solinadigan foyda ${N(x)} so'm, foyda solig'i stavkasi 15%. Foyda solig'i?`,a,`${N(x)} × 15% = ${N(a)} so'm.`);},
    R=>{const x=M(R,20,500),y=M(R,1,40),a=(x+y)*15/100; return calc(`Buxgalteriya foydasi ${N(x)} so'm, chegirilmaydigan xarajatlar ${N(y)} so'm. Foyda solig'i 15%. Soliq summasi?`,a,`Soliq bazasi = ${N(x)} + ${N(y)} = ${N(x+y)}. × 15% = ${N(a)} so'm.`);},
    R=>{const x=K(R,20,900),a=x*4/100; return calc(`Aylanmadan olinadigan soliq stavkasi 4%. Oylik tushum ${N(x)} so'm. Soliq summasi?`,a,`${N(x)} × 4% = ${N(a)} so'm.`);},
    R=>{const x=M(R,5,300),a=x*95/100; return calc(`Jismoniy shaxs ta'sischiga ${N(x)} so'm dividend hisoblandi, 5% soliq ushlanadi. Ta'sischiga to'lanadigan summa?`,a,`${N(x)} − 5% = ${N(a)} so'm.`);},
    R=>{const x=K(R,5,200),d=ri(R,5,60),a=x*33/100000*d; return calc(`Soliq qarzi ${N(x)} so'm, ${d} kun kechiktirildi. Masala sharti: penya kuniga 0,033%. Penya summasi?`,a,`${N(x)} × 0,033% × ${d} = ${N(a)} so'm.`);},
    R=>{const x=M(R,100,2000),r=pick(R,[1,1.5,2]),a=x*r/100; return calc(`Mol-mulkning o'rtacha yillik qiymati ${N(x)} so'm. Masala sharti: stavka ${String(r).replace(".",",")}%. Yillik mol-mulk solig'i?`,a,`${N(x)} × ${String(r).replace(".",",")}% = ${N(a)} so'm.`);},
    R=>pv(R,`Yil yakunida ${N(M(R,2,90))} so'm foyda solig'i hisoblandi.`,"9810","6410","Foyda solig'i xarajati (Dt 9810), budjetga qarz (Kt 6410)."),
    R=>pv(R,`Budjetga ${N(M(R,2,90))} so'm soliq bank orqali to'landi.`,"6410","5110","Budjetga qarz yopiladi (Dt 6410), bank hisobi kamayadi (Kt 5110)."),
    R=>pv(R,`Ta'sischilarga ${N(M(R,5,200))} so'm dividend e'lon qilindi.`,"8710","6610","Taqsimlanmagan foyda kamayadi (Dt 8710), dividend qarzi paydo bo'ladi (Kt 6610)."),
    R=>pv(R,`Dividenddan ${N(K(R,5,90))} so'm soliq ushlandi.`,"6610","6410","Ta'sischiga qarz kamayadi (Dt 6610), budjetga qarz oshadi (Kt 6410)."),
    R=>pv(R,`Ta'sischilarga ${N(M(R,5,200))} so'm dividend bank orqali to'landi.`,"6610","5110","Dividend qarzi yopiladi (Dt 6610), bank kamayadi (Kt 5110).")]},
  mhxs:{icon:"🌐",title:"MHXS",n:0,tpl:[
    R=>{const b=M(R,50,300),f=b-M(R,5,40),v=b-M(R,5,40),q=Math.max(f,v); return calc(`MHXS (IAS) 36: aktivning balans qiymati ${N(b)} so'm, sotish xarajatlari chegirilgan adolatli qiymati ${N(f)} so'm, foydalanish qiymati ${N(v)} so'm. Qadrsizlanish zarari?`,b-q,`Qoplanadigan qiymat — ikkisining KATTASI: ${N(q)}. Zarar = ${N(b)} − ${N(q)} = ${N(b-q)} so'm.`);},
    R=>{const s=ri(R,1,50)*100000,e=ri(R,50,900); return calc(`MHXS (IAS) 33: sof foyda ${N(s*e)} so'm, oddiy aksiyalarning o'rtacha tortilgan soni ${N(s)} dona. Bir aksiyaga foyda (EPS), so'm?`,e,`EPS = ${N(s*e)} ÷ ${N(s)} = ${N(e)} so'm.`);}],
   fixed:[
    mc("MHXS (IAS) 2 bo'yicha zaxiralarni baholashda qaysi usul TAQIQLANGAN?",["LIFO","FIFO","O'rtacha tortilgan tannarx","Alohida identifikatsiya"],"IAS 2 LIFO usulini taqiqlaydi."),
    mc("IAS 2: zaxiralar balansda qanday baholanadi?",["Tannarx va sof sotish qiymatining kichigida","Faqat bozor narxida","Tannarx va sof sotish qiymatining kattasida","Sotish narxida"],"Zaxiralar tannarx va sof sotish qiymatining eng kichigida baholanadi."),
    mc("IFRS 15 bo'yicha tushumni tan olish modeli necha bosqichdan iborat?",["5 bosqich","3 bosqich","4 bosqich","7 bosqich"],"Shartnoma → majburiyatlar → narx → taqsimlash → tan olish: 5 bosqich."),
    mc("IFRS 15: tushum qachon tan olinadi?",["Tovar yoki xizmat ustidan nazorat xaridorga o'tganda","Pul olinganda","Shartnoma imzolanganda","Faktura yozilganda"],"Asosiy mezon — nazoratning xaridorga o'tishi."),
    mc("IFRS 16: ijarachi (lessee) balansida asosan nima tan olinadi?",["Foydalanish huquqi aktivi va ijara majburiyati","Faqat ijara xarajati","Faqat izohda oshkor qilinadi","Ijaraga beruvchining aktivi"],"Ijarachi «right-of-use» aktivi va ijara majburiyatini tan oladi."),
    mc("IFRS 16: 12 oygacha bo'lgan qisqa muddatli ijarani ijarachi qanday hisobga olishi mumkin?",["Soddalashtirish: to'lovlarni xarajat sifatida","Majburiy ravishda aktiv sifatida","Kapitalga olib boriladi","Hisobga olinmaydi"],"Qisqa muddatli va kam qiymatli ijaraga soddalashtirish ruxsat etilgan."),
    mc("IAS 7: pul oqimlari qaysi uch faoliyat bo'yicha ko'rsatiladi?",["Operatsion, investitsion, moliyaviy","Sotish, xarid, soliq","Asosiy, yordamchi, boshqa","Kassa, bank, valyuta"],"Pul oqimlari hisoboti 3 bo'limdan iborat."),
    mc("IAS 7: asosiy vosita sotib olishga to'langan pul qaysi faoliyatga kiradi?",["Investitsion","Operatsion","Moliyaviy","Hech qaysi"],"Uzoq muddatli aktiv xaridi — investitsion faoliyat."),
    mc("IAS 7: bank kreditini olish qaysi faoliyatga kiradi?",["Moliyaviy","Investitsion","Operatsion","Hech qaysi"],"Qarz olish va qaytarish — moliyaviy faoliyat."),
    mc("IAS 16: asosiy vosita dastlab qanday baholanadi?",["Tannarx bo'yicha","Adolatli qiymat bo'yicha","Sotish narxi bo'yicha","Qoldiq qiymat bo'yicha"],"Dastlabki tan olish — tannarx bo'yicha."),
    mc("IAS 16: dastlabki tan olingandan keyin qaysi baholash modellari mumkin?",["Tannarx modeli yoki qayta baholash modeli","Faqat adolatli qiymat","Faqat LIFO","Faqat bozor narxi"],"Firma hisob siyosatida ikki modeldan birini tanlaydi."),
    mc("IAS 16: amortizatsiya qachon boshlanadi?",["Aktiv foydalanishga tayyor bo'lganda","Yil boshidan","To'lov qilinganda","Birinchi ta'mirdan keyin"],"Aktiv mo'ljallangan foydalanishga tayyor bo'lgan paytdan."),
    mc("IAS 16: yer uchastkasi odatda amortizatsiya qilinadimi?",["Yo'q — xizmat muddati cheklanmagan","Ha, 20 yilda","Ha, 5 yilda","Faqat qayta baholansa"],"Yerning foydali xizmat muddati odatda cheklanmagan."),
    mc("IAS 36: qoplanadigan qiymat qanday aniqlanadi?",["Sotish xarajatlari chegirilgan adolatli qiymat va foydalanish qiymatining kattasi","Ikkisining kichigi","Faqat bozor narxi","Boshlang'ich qiymat"],"Recoverable amount = max(FVLCD, VIU)."),
    mc("IAS 38: ichki yaratilgan gudvil qanday hisobga olinadi?",["Aktiv sifatida tan olinmaydi","Nomoddiy aktiv sifatida","Kapitalga qo'shiladi","Daromad sifatida"],"Ichki yaratilgan gudvil tan olinmaydi."),
    mc("IAS 38: tadqiqot (research) bosqichi xarajatlari qanday hisobga olinadi?",["Davr xarajati sifatida","Nomoddiy aktiv sifatida","Kapitalga","Zaxira sifatida"],"Tadqiqot xarajati darhol xarajatga; ishlanma — shartlar bajarilsa aktiv."),
    mc("IAS 37: zahira (provision) qachon tan olinadi?",["Joriy majburiyat bor, resurs chiqishi ehtimoli yuqori va summa ishonchli baholanadi","Har qanday kelajakdagi xarajat uchun","Faqat sud qarori bo'lsa","Hech qachon"],"Uchala shart birga bajarilishi kerak."),
    mc("IAS 37: shartli majburiyat qanday aks ettiriladi?",["Tan olinmaydi, izohda oshkor qilinadi","Balansda majburiyat sifatida","Xarajat sifatida","Kapitaldan chegiriladi"],"Shartli majburiyat faqat izohda."),
    mc("IAS 10: hisobot sanasidan keyin yirik debitorning bankrot bo'lgani ma'lum bo'ldi (holat sanagacha mavjud edi). Bu qanday hodisa?",["Tuzatuvchi hodisa","Tuzatilmaydigan hodisa","Shartli aktiv","Hisob siyosati o'zgarishi"],"Hisobot sanasida mavjud holatni tasdiqlaydi — hisobot tuzatiladi."),
    mc("IAS 8: hisob siyosatidagi o'zgarish qanday qo'llaniladi?",["Retrospektiv (o'tgan davrlarga ham)","Faqat kelajakka","Qo'llanilmaydi","Faqat joriy oyga"],"Siyosat o'zgarishi — retrospektiv."),
    mc("IAS 8: hisob baholaridagi o'zgarish (masalan, xizmat muddati) qanday qo'llaniladi?",["Prospektiv (joriy va keyingi davrlarga)","Retrospektiv","Kapitalga to'g'ridan-to'g'ri","Hech qanday"],"Baho o'zgarishi — prospektiv."),
    mc("IAS 1: moliyaviy hisobotlarning to'liq to'plamiga nima KIRMAYDI?",["Soliq deklaratsiyasi","Pul oqimlari hisoboti","Kapitaldagi o'zgarishlar hisoboti","Izohlar"],"Soliq deklaratsiyasi MHXS hisobotiga kirmaydi."),
    mc("IAS 21: funksional valyuta nima?",["Firma faoliyat yuritadigan asosiy iqtisodiy muhit valyutasi","Har doim AQSh dollari","Ta'sischilar valyutasi","Eng barqaror valyuta"],"Asosiy iqtisodiy muhit valyutasi."),
    mc("IAS 21: valyutadagi monetar moddalar (pul, debitorlar) hisobot sanasida qaysi kurs bo'yicha qayta hisoblanadi?",["Yakuniy (hisobot sanasidagi) kurs","Tarixiy kurs","O'rtacha yillik kurs","Qayta hisoblanmaydi"],"Monetar moddalar — yakuniy kurs bo'yicha."),
    mc("IAS 12: kechiktirilgan soliq nimadan yuzaga keladi?",["Buxgalteriya va soliq bazasi o'rtasidagi vaqtinchalik farqlardan","Jarimalardan","Dividendlardan","Faqat zararlardan"],"Vaqtinchalik farqlar kechiktirilgan soliq aktivi/majburiyatini beradi."),
    mc("IFRS 9: moliyaviy aktivlar qadrsizlanishi qaysi model bo'yicha?",["Kutilayotgan kredit zararlari (ECL)","Yuz bergan zararlar","LIFO","Bozor narxi"],"IFRS 9 — kutilayotgan kredit zararlari modeli."),
    mc("Konseptual asos: moliyaviy axborotning ikki fundamental sifat xususiyati?",["Ahamiyatlilik va haqqoniy aks ettirish","Tezlik va arzonlik","Qisqalik va chiroylilik","Soliq va daromad"],"Relevance va faithful representation."),
    mc("Hisobot tuzishda «uzluksizlik» (going concern) tamoyili nimani anglatadi?",["Firma yaqin kelajakda faoliyatini davom ettiradi deb faraz qilinadi","Firma har yili yopiladi","Hisobot uzluksiz yoziladi","Soliq to'xtovsiz to'lanadi"],"Faoliyat davom etadi degan faraz."),
    mc("IAS 40: investitsion mulk nima?",["Ijara daromadi yoki qiymat oshishi uchun ushlab turiladigan ko'chmas mulk","Ofis binosi","Sotish uchun tovar","Ishlab chiqarish sexi"],"O'z faoliyatida ishlatilmaydigan, ijara/qiymat o'sishi uchun mulk."),
    mc("IFRS 13: adolatli qiymat — bu ...",["Bozor ishtirokchilari o'rtasida aktivni sotishda olinadigan narx","Xarid narxi","Balans qiymati","Soliq qiymati"],"Exit price — sotishda olinadigan narx."),
    mc("IAS 23: malakali aktivga bevosita tegishli qarz xarajatlari (foizlar) qanday hisobga olinadi?",["Aktiv tannarxiga kapitallashtiriladi","Doim xarajatga","Kapitaldan chegiriladi","Hisobga olinmaydi"],"Malakali aktiv uchun foizlar kapitallashtiriladi."),
    mc("IAS 20: davlat subsidiyasi qachon tan olinadi?",["Shartlar bajarilishi va subsidiya olinishiga ishonch bo'lganda","Ariza berilganda","Faqat yil oxirida","Hech qachon"],"Ishonchli asos bo'lganda, tizimli ravishda daromadga."),
    mc("IFRS 5: sotish uchun ushlab turiladigan uzoq muddatli aktivga nima bo'ladi?",["Amortizatsiya to'xtatiladi","Amortizatsiya ikki baravar oshadi","Aktiv hisobdan chiqariladi","Qayta baholanmaydi va o'zgarmaydi"],"Balans qiymati va FVLCD kichigida baholanadi, amortizatsiya to'xtaydi."),
    mc("IAS 24: bog'liq tomonlar bilan operatsiyalar qanday aks ettiriladi?",["Izohlarda oshkor qilinadi","Yashiriladi","Faqat soliq organiga beriladi","Hisobotdan chiqariladi"],"Bog'liq tomonlar va operatsiyalar oshkor qilinadi."),
    mc("IAS 19: qisqa muddatli xodim nafaqalari (ish haqi, ta'til) qachon xarajatga olinadi?",["Xodim xizmat ko'rsatgan davrda","To'langan kuni","Yil oxirida","Xodim ishdan ketganda"],"Hisoblash tamoyili — xizmat ko'rsatilgan davrda.")]},
  pro:{icon:"🧮",title:"Provodka",n:45,tpl:[
    R=>pv(R,`Bankdan kassaga ${N(K(R,5,90))} so'm naqd olindi.`,"5010","5110","Kassa ko'payadi (Dt 5010), bank kamayadi (Kt 5110)."),
    R=>pv(R,`Kassadagi ${N(K(R,5,90))} so'm naqd bankka topshirildi.`,"5110","5010","Bank ko'payadi (Dt 5110), kassa kamayadi (Kt 5010)."),
    R=>pv(R,`Xaridordan ${N(M(R,2,90))} so'm qarz bankka tushdi.`,"5110","4010","Bank ko'payadi (Dt 5110), debitorlik kamayadi (Kt 4010)."),
    R=>pv(R,`Yetkazib beruvchiga ${N(M(R,2,90))} so'm qarz bankdan to'landi.`,"6010","5110","Qarz kamayadi (Dt 6010), bank kamayadi (Kt 5110)."),
    R=>pv(R,`Yetkazib beruvchiga ${N(M(R,2,90))} so'm oldindan to'lov (bo'nak) o'tkazildi.`,"4310","5110","Berilgan bo'nak — debitorlik (Dt 4310), bank kamayadi (Kt 5110)."),
    R=>pv(R,`Tovar kelgach, yetkazib beruvchiga berilgan ${N(M(R,2,90))} so'm bo'nak hisobga olindi.`,"6010","4310","Qarz bo'nak hisobidan yopiladi (Dt 6010), bo'nak yopiladi (Kt 4310)."),
    R=>pv(R,`Xaridordan ${N(M(R,2,90))} so'm oldindan to'lov (bo'nak) bankka tushdi.`,"5110","6310","Bank ko'payadi (Dt 5110), olingan bo'nak — majburiyat (Kt 6310)."),
    R=>pv(R,`Tovar jo'natilgach, xaridordan olingan ${N(M(R,2,90))} so'm bo'nak hisobga olindi.`,"6310","4010","Bo'nak majburiyati yopiladi (Dt 6310), xaridor qarzi yopiladi (Kt 4010)."),
    R=>pv(R,`Tayyor mahsulot ${N(M(R,5,200))} so'mga xaridorga sotildi (daromad).`,"4010","9010","Xaridor qarzi (Dt 4010), mahsulot sotishdan daromad (Kt 9010)."),
    R=>pv(R,`Sotilgan tayyor mahsulotning ${N(M(R,5,150))} so'm tannarxi hisobdan chiqarildi.`,"9110","2810","Tannarx (Dt 9110), ombordagi mahsulot kamayadi (Kt 2810)."),
    R=>pv(R,`Tovarlar ${N(M(R,5,200))} so'mga xaridorga sotildi (daromad).`,"4010","9020","Xaridor qarzi (Dt 4010), tovar sotishdan daromad (Kt 9020)."),
    R=>pv(R,`Mijozga ${N(M(R,1,90))} so'mlik xizmat ko'rsatildi (akt imzolandi).`,"4010","9030","Xaridor qarzi (Dt 4010), xizmatdan daromad (Kt 9030)."),
    R=>pv(R,`Xodimga xizmat safari uchun kassadan ${N(K(R,5,50))} so'm bo'nak berildi.`,"4220","5010","Hisobdor shaxs qarzi (Dt 4220), kassa kamayadi (Kt 5010)."),
    R=>pv(R,`Bo'nak hisoboti tasdiqlandi: ${N(K(R,5,50))} so'm safar xarajati ma'muriy xarajatga olindi.`,"9420","4220","Ma'muriy xarajat (Dt 9420), hisobdor qarzi yopiladi (Kt 4220)."),
    R=>pv(R,`Bankdan 6 oyga ${N(M(R,20,500))} so'm kredit olindi.`,"5110","6810","Bank ko'payadi (Dt 5110), qisqa muddatli kredit (Kt 6810)."),
    R=>pv(R,`Bankdan 3 yilga ${N(M(R,50,900))} so'm kredit olindi.`,"5110","7810","Bank ko'payadi (Dt 5110), uzoq muddatli kredit (Kt 7810)."),
    R=>pv(R,`Qisqa muddatli kredit ${N(M(R,20,500))} so'm qaytarildi.`,"6810","5110","Kredit qarzi kamayadi (Dt 6810), bank kamayadi (Kt 5110)."),
    R=>pv(R,`Kredit bo'yicha ${N(K(R,5,90))} so'm foiz hisoblandi.`,"9610","6920","Foiz xarajati (Dt 9610), hisoblangan foiz majburiyati (Kt 6920)."),
    R=>pv(R,`Hisoblangan ${N(K(R,5,90))} so'm foiz bankka to'landi.`,"6920","5110","Foiz qarzi yopiladi (Dt 6920), bank kamayadi (Kt 5110)."),
    R=>pv(R,`Ta'sis hujjatlarida ${N(M(R,10,500))} so'm ustav kapital ro'yxatdan o'tkazildi.`,"4610","8330","Ta'sischilar qarzi (Dt 4610), ustav kapital (Kt 8330)."),
    R=>pv(R,`Ta'sischi ustav kapitalga ${N(M(R,10,500))} so'm pul kiritdi.`,"5110","4610","Bank ko'payadi (Dt 5110), ta'sischi qarzi yopiladi (Kt 4610)."),
    R=>pv(R,`Valyuta hisobidagi qoldiq qayta baholandi: kurs oshgani uchun ${N(K(R,2,90))} so'm farq.`,"5210","9540","Valyuta hisobi ko'payadi (Dt 5210), kurs farqidan daromad (Kt 9540)."),
    R=>pv(R,`Valyuta hisobidagi qoldiq qayta baholandi: kurs tushgani uchun ${N(K(R,2,90))} so'm farq.`,"9620","5210","Kurs farqidan zarar (Dt 9620), valyuta hisobi kamayadi (Kt 5210)."),
    R=>pv(R,`Oy yakunida mahsulot sotishdan ${N(M(R,50,900))} so'm daromad yakuniy natijaga yopildi.`,"9010","9910","Daromad hisobvarag'i yopiladi (Dt 9010), yakuniy natijaga (Kt 9910)."),
    R=>pv(R,`Oy yakunida sotilgan mahsulot tannarxi ${N(M(R,30,600))} so'm yakuniy natijaga yopildi.`,"9910","9110","Xarajat yakuniy natijaga (Dt 9910), tannarx hisobvarag'i yopiladi (Kt 9110)."),
    R=>pv(R,`Yil yakunida ${N(M(R,10,500))} so'm sof foyda taqsimlanmagan foydaga o'tkazildi.`,"9910","8710","Yakuniy natija yopiladi (Dt 9910), taqsimlanmagan foyda (Kt 8710)."),
    R=>pv(R,`Yetkazib beruvchidan ${N(M(R,5,150))} so'mlik tovar olindi (QQSsiz).`,"2910","6010","Tovar (Dt 2910), yetkazib beruvchiga qarz (Kt 6010)."),
    R=>pv(R,`Budjetga ${N(M(R,2,90))} so'm soliq qarzi to'landi.`,"6410","5110","Budjetga qarz yopiladi (Dt 6410), bank kamayadi (Kt 5110).")]}
  };
  const out=[];
  Object.keys(T).forEach((id,ti)=>{ const tp=T[id], R=srng(hstr("liga-"+id)), seen=new Set(), list=[];
    (tp.fixed||[]).forEach(q=>{ seen.add(q.q); list.push(q); });
    const n=tp.n||(list.length+tp.tpl.length*6);
    for(let k=0;list.length<n&&k<n*6;k++){ const q=tp.tpl[k%tp.tpl.length](R); if(seen.has(q.q)) continue; seen.add(q.q); list.push(q); }
    list.forEach((q,k)=>{ q.id="T"+id+"-"+k; q.tp=id;  });
    out.push({id,icon:tp.icon,title:tp.title,tasks:list}); });
  return out;
})();

return TOPICS;
}
