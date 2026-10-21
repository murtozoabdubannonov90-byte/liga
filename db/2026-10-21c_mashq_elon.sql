-- 2026-10-21c · Mashq zali: ish kunlari 18:30 (Toshkent) da bot guruh(lar)ga va kanalga oylik jamg'arma va top-5 ni e'lon qiladi.
-- Bosqichlar 17:00 da yopiladi — e'lon o'yinga xalaqit bermaydi. Qo'lda: select public.liga_bot_call('px_board_now');
do $$ begin
  perform cron.unschedule('liga-mashq-elon') where exists (select 1 from cron.job where jobname = 'liga-mashq-elon');
  perform cron.schedule('liga-mashq-elon', '30 13 * * 1-5', $c$select public.liga_bot_call('px_board')$c$);
end $$;
