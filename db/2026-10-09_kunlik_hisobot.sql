-- 2026-10-09 · Admin uchun kunlik hisobot (bot har kuni 20:00 Toshkent = 15:00 UTC)
-- liga_daily_report_sys(p_code) — jamoa bo'yicha bugungi raqamlar (faqat service_role / cron).

create or replace function public.liga_daily_report_sys(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Tashkent')::date;
  t0 timestamptz := (d::timestamp at time zone 'Asia/Tashkent');
  t1 timestamptz := t0 + interval '1 day';
  wd int := extract(isodow from d);
  r jsonb;
begin
  with pl as (
    select id, trim(coalesce(first_name,'') || ' ' || coalesce(left(last_name,1) || '.','')) nm,
           created_at, last_active, tg_user_id, week_xp, paid_until
    from safari_players where coalesce(group_code,'ASOSIY') = p_code
  ),
  st as (
    select r.player_id, max(r.gain + coalesce(r.bonus,0)) pts, max(r.right_n) rn, max(r.done_n) dn, bool_or(r.finished_at is not null) fin
    from liga_runs r join pl on pl.id = r.player_id
    where r.kind = 'stage' and r.started_at >= t0 and r.started_at < t1
    group by r.player_id
  ),
  cup as (
    select dd.*, l.note, l.status from liga_day_duels dd left join liga_live l on l.code = dd.code
    where dd.day = d and dd.group_code = p_code
  )
  select jsonb_build_object(
    'day', d, 'wd', wd, 'trial', coalesce((select value = 'on' from liga_bot_config where key = 'trial_mode'), false),
    'total', (select count(*) from pl),
    'tg', (select count(tg_user_id) from pl),
    'new', coalesce((select jsonb_agg(nm order by created_at) from pl where created_at >= t0 and created_at < t1), '[]'),
    'active', (select count(*) from pl where last_active >= t0 and last_active < t1),
    'stage', coalesce((select jsonb_agg(jsonb_build_object('n', pl.nm, 'p', st.pts, 'r', st.rn, 'd', st.dn, 'f', st.fin) order by st.pts desc nulls last)
                       from st join pl on pl.id = st.player_id), '[]'),
    'idle', case when wd between 1 and 5 then coalesce((select jsonb_agg(nm order by nm) from pl where id not in (select player_id from st)), '[]') else '[]' end,
    'cup_n', (select count(*) from cup),
    'cup_played', (select count(*) from cup where status = 'done' and note is null),
    'cup_forfeit', (select count(*) from cup where note = 'forfeit'),
    'cup_cancel', (select count(*) from cup where note = 'cancel'),
    'champ', (select pl.nm from liga_day_cups c join pl on pl.id = c.champion where c.day = d and c.group_code = p_code),
    'duels', (select count(*) from liga_runs r join pl on pl.id = r.player_id where r.kind = 'duel' and r.started_at >= t0 and r.started_at < t1)
           + (select count(*) from liga_live l where l.kind = 'free' and l.created_at >= t0 and l.created_at < t1
                and (l.a_id in (select id from pl) or l.b_id in (select id from pl))),
    'pay_n', (select count(*) from liga_invoices where group_code = p_code and created_at >= t0 and created_at < t1),
    'pay_sum', (select coalesce(sum(amount),0) from liga_invoices where group_code = p_code and status in ('paid','check') and created_at >= t0 and created_at < t1),
    'pay_wait', (select count(*) from liga_invoices where group_code = p_code and status = 'check'),
    'expiring', coalesce((select jsonb_agg(nm order by paid_until) from pl where paid_until >= d and paid_until < d + 4), '[]'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('n', nm, 'x', week_xp) order by week_xp desc)
                     from (select nm, week_xp from pl where coalesce(week_xp,0) > 0 order by week_xp desc limit 3) z), '[]'),
    'cron_bad', (select count(*) from cron.job_run_details where start_time >= t0 and start_time < t1 and status <> 'succeeded'),
    'cron_ok', (select count(*) from cron.job_run_details where start_time >= t0 and start_time < t1 and status = 'succeeded'),
    'http_bad', (select count(*) from net._http_response where created >= t0 and created < t1 and (status_code is null or status_code >= 300))
  ) into r;
  return r;
end $$;
