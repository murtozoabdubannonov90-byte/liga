-- 2026-10-27 · Bosqichni boshlab tugatmaganlarga alohida eslatma, valyuta kursi ish kunlari 09:00/11:00, SMS cron o'chirildi
-- Bot: bot/index.ts — remind_half (15:00), remind_noon/remind matnlari tugatmaganlarga alohida; fetchRates — cbu.uz → gazeta.uz (MB) → open.er-api.com

-- bugungi bosqichni boshlagan, lekin oxiriga yetkazmaganlar (Telegram'ga ulangan, obunasi faol)
create or replace function public.liga_half_list_sys()
returns table(tg bigint, first_name text, lang text, stage int, group_code text, done_n int, total int, right_n int)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, coalesce(s.lang,'uz'), r.ref::int, s.group_code,
         r.done_n, coalesce(cardinality(r.qids), 20), r.right_n
  from public.liga_runs r
  join public.safari_players s on s.id = r.player_id
  join public.liga_groups g on g.code = s.group_code
  where r.kind = 'stage' and r.finished_at is null
    and r.week_id = public.liga_cur_week_id()
    and r.ref = (public.liga_stage_index(g.start_date, public.liga_today()))::text
    and s.tg_user_id is not null and g.active and public.liga_player_ok(s.id)
    and r.done_n < coalesce(cardinality(r.qids), 20)
$$;
revoke all on function public.liga_half_list_sys() from public, anon, authenticated;
grant execute on function public.liga_half_list_sys() to service_role;

-- cron (UTC): tugatmaganlarga 15:00 (Toshkent); kurs ish kunlari 09:00 va 11:00; SMS o'chirildi (sms_mode=off, hech qachon ishlatilmagan)
select cron.schedule('liga-tugatmaganlar', '0 10 * * 1-5', $$select public.liga_bot_call('remind_half')$$);
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'liga-kurs'),
  schedule := '0 4,6 * * 1-5', command := $$select public.liga_bot_call('rates')$$);
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'liga-sms'), active := false);
