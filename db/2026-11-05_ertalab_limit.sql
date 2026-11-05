-- 2026-11-05: ertalabki day_start Edge 150 s limitidan oshib, yarmida to'xtadi (546) — bugungi kubok boshlanmadi.
-- Sabab: day_start ichida 548 kishiga shaxsiy xabar ketgandan KEYIN kubok juftlari tuzilardi (04.11 da 101 s, 05.11 da >150 s).

-- 1) QO'LLANDI (05.11): kubok juftlari day_start dan oldin, alohida chaqiruvda
select cron.schedule('liga-kubok-juftlar', '58 3 * * 1-5', $$select public.liga_bot_call('cup_schedule')$$);

-- 2) bot/index.ts (yangi versiya) deploy qilingandan KEYIN qo'llang:
--    shaxsiy ertalabki xabarlar navbat bilan, har daqiqa 105 s dan oshmay (day_dm), 09:01–09:20
-- select cron.schedule('liga-kun-boshi-dm', '1-20 4 * * 1-5', $$select public.liga_bot_call('day_dm')$$);
--    va kubok endi day_start ichida guruhga birinchi chiqadi, shuning uchun 1-bandni o'chirsa bo'ladi:
-- select cron.unschedule('liga-kubok-juftlar');
