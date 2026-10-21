-- 2026-10-21e · «Mashq zali» → «Sovrinli musobaqa». Oylik sovrin jamg'armasi qat'iy 300 000 so'm (to'lovlardan o'smaydi),
-- taqsimot 50/30/20 % → 150 000 / 90 000 / 60 000 so'm, g'oliblar 31-oktabr yakunida (obunasi faol kuchli uchlik).
-- 22.10.2026 09:05–09:20 da (har daqiqa 80 tadan) Telegram'ga ulangan har bir ishtirokchiga shaxsiy e'lon (bot amali px_announce, bir marta).
insert into public.liga_bot_config(key, value) values ('px_fund_base', '300000') on conflict (key) do update set value = excluded.value;
insert into public.liga_bot_config(key, value) values ('px_fund_per_pay', '0') on conflict (key) do update set value = excluded.value;
insert into public.liga_bot_config(key, value) values ('px_split', '50,30,20') on conflict (key) do update set value = excluded.value;
insert into public.liga_bot_config(key, value) values ('px_announce_day', '2026-10-22') on conflict (key) do update set value = excluded.value;
do $$ begin
  perform cron.unschedule('liga-musobaqa-elon') where exists (select 1 from cron.job where jobname = 'liga-musobaqa-elon');
  perform cron.schedule('liga-musobaqa-elon', '5-20 4 * * *', $c$select public.liga_bot_call('px_announce')$c$);
end $$;
