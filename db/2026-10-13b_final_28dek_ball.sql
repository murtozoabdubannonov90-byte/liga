-- 2026-10-13 · Katta final 28.12.2026 ga, oktyabr reytingi 12.10.2026 dan; sertifikat imzosi; s9-07 o'yindan olindi
update public.liga_bot_config set value = '2026-12-28' where key = 'gf_date';
insert into public.liga_bot_config(key, value) values ('gf_from', '2026-10-12') on conflict (key) do update set value = excluded.value;
update public.liga_bot_config set value = 'Hisobchi Liga Kengashi' where key = 'cert_signer';
update public.liga_bank set active = false where id = 's9-07';
-- liga_month_rank: faqat gf_from dan boshlangan haftalar (to'liq matn — migratsiya katta_final_28dek_12okt)
