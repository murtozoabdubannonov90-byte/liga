-- 2026-10-31d · Sovrinli musobaqa oktabr yakuni: 31.10 20:00 (Toshkent) da g'oliblar guruh(lar), muhokama guruhi va kanalga,
-- g'oliblarga shaxsan; «admin bilan bog'laning (@murtozo_44)», «keyingi bosqich tez orada». Bot amali: px_final (bir marta).
create or replace function public.liga_px_final_sys(p_mon text)
returns table(pos int, player uuid, name text, pts int, amount bigint, tg bigint, lang text)
language sql stable security definer set search_path = public as $$
  with sp as (select public.liga_px_split() s, public.liga_px_fund('ASOSIY', p_mon) f),
  w as (
    select m.player_id, m.pts, row_number() over (order by m.pts desc, m.games asc) rk
    from public.liga_px_month_pts('ASOSIY', p_mon) m
    where m.pts > 0 and public.liga_px_prize_ok(m.player_id, p_mon))
  select w.rk::int, w.player_id, public.liga_px_pname(w.player_id), w.pts::int,
         (sp.f * coalesce(sp.s[w.rk], 0) / 100)::bigint, s.tg_user_id, coalesce(s.lang, 'uz')
  from w cross join sp join public.safari_players s on s.id = w.player_id
  where w.rk <= coalesce(array_length(sp.s, 1), 3)
  order by w.rk
$$;
revoke all on function public.liga_px_final_sys(text) from public, anon, authenticated;
grant execute on function public.liga_px_final_sys(text) to service_role;
-- bir martalik: 31.10.2026 20:00 Toshkent = 15:00 UTC
select cron.schedule('liga-px-yakun', '0 15 31 10 *', $c$select public.liga_bot_call('px_final')$c$);
