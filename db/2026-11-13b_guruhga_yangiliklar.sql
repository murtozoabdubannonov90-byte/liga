-- 2026-11-13: har qanday liga yangiligi muhokama guruhiga chiqadi (bot: upd_tick).
-- Manbalar: (1) ilova relizi — bot GitHub Pages'dagi release.json ni tekshiradi; (2) administrator botda «/yangilik matn».
-- liga_updates.source: 'ver:<versiya>' yoki 'admin'; status: draft → sending → done | fail | cancel.
create unique index if not exists liga_updates_ver_uq on public.liga_updates (source) where source like 'ver:%';
-- 08:00–20:59 (Toshkent) har 5 daqiqada: yangi reliz bormi + navbatdagi yangiliklarni yuborish. Kechasi guruhga yozilmaydi.
select cron.unschedule('liga-yangilik') where exists (select 1 from cron.job where jobname = 'liga-yangilik');
select cron.schedule('liga-yangilik', '*/5 3-15 * * *', $$select public.liga_bot_call('upd_tick')$$);
