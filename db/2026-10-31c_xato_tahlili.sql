-- 2026-10-31c · Ertalabki «Kechagi xatoingiz» (bot, ish kunlari 09:20): oldingi bosqich kunida xato qilgan yoki
-- bosqichni tugatmagan o'yinchiga bitta (eng qiyin — oxirgi) xato savoli: to'g'ri javob va tushuntirish bilan.
-- Navbat tg_user_id bo'yicha (liga_bot_config: err_review_last_<sana>), har chaqiruvda 80 kishi.
-- + SINOV10 — ro'yxatsiz 10 savollik ochiq sinov (ilova: ?t=SINOV10, oxirida «Ligaga qo'shilish — bepul»).

create or replace function public.liga_err_review_sys(p_after bigint default 0, p_limit int default 80)
returns table(tg bigint, lang text, first_name text, t text, q text, ans text, e text, right_n int, done_n int, n int, day date)
language sql stable security definer set search_path = public as $$
  with d as (
    select max((r.started_at at time zone 'Asia/Tashkent')::date) dd from public.liga_runs r
    where r.kind = 'stage' and (r.started_at at time zone 'Asia/Tashkent')::date < public.liga_today()
      and r.started_at > now() - interval '5 days'),
  runs as (
    select r.* from public.liga_runs r, d
    where r.kind = 'stage' and (r.started_at at time zone 'Asia/Tashkent')::date = d.dd),
  pick as (
    select distinct on (r.player_id) r.player_id, r.lang rl, r.right_n, r.done_n, coalesce(array_length(r.qids, 1), 20) nq, a.qid
    from runs r join public.liga_run_ans a on a.run_id = r.id
    where a.ok is false and a.qid is not null
    order by r.player_id, a.k desc)
  select s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name, b.t,
    (case when p.rl = 'ru' then b.ru else b.uz end)->>'q',
    case b.t when 'pv' then (case when p.rl = 'ru' then 'Дт ' || b.dt || ' — Кт ' || b.kt else 'Dt ' || b.dt || ' — Kt ' || b.kt end)
             when 'mc' then (case when p.rl = 'ru' then b.ru else b.uz end)->'o'->>(b.a::int)
             else replace(to_char(b.a, 'FM999,999,999,990.##'), ',', ' ') || ' ' || coalesce((case when p.rl = 'ru' then b.ru else b.uz end)->>'unit', '') end,
    (case when p.rl = 'ru' then b.ru else b.uz end)->>'e',
    p.right_n, p.done_n, p.nq, (select dd from d)
  from pick p
  join public.safari_players s on s.id = p.player_id
  join public.liga_bank b on b.id = p.qid
  where s.tg_user_id is not null and s.tg_user_id > coalesce(p_after, 0)
  order by s.tg_user_id
  limit greatest(1, least(coalesce(p_limit, 80), 200))
$$;
revoke all on function public.liga_err_review_sys(bigint, int) from public, anon, authenticated;
grant execute on function public.liga_err_review_sys(bigint, int) to service_role;

insert into public.liga_tests(code, group_code, title, n, minutes, lang, active)
values ('SINOV10', 'ASOSIY', 'Hisobchi Liga — 10 savollik sinov', 10, 10, 'uz', true)
on conflict (code) do update set title = excluded.title, n = excluded.n, minutes = excluded.minutes, active = true;

-- ish kunlari 09:20–09:25 (Toshkent), har daqiqada navbatdagi 80 kishi
select cron.schedule('liga-xato-tahlili', '20-25 4 * * 1-5', $c$select public.liga_bot_call('err_review')$c$);
