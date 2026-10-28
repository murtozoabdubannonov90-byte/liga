-- 2026-10-28: Kubok ro'yxati va «Bugungi duel» ilovada yangilanmay qolgani tuzatildi.
-- Sabab: liga_cup_advance ichida `delete from _cup_w;` (WHERE'siz). Supabase API (PostgREST)
-- orqali chaqirilganda pg_safeupdate uni «DELETE requires a WHERE clause» deb to'xtatadi.
-- liga_cup_list / liga_day_duel_me / liga_cup_due_sys avval liga_cup_try_advance ni chaqiradi,
-- shuning uchun raund tugagach (ayniqsa 17:00 finaldan keyin) ilovadan kelgan har so'rov 400 qaytardi
-- (27.10 da ~1000 marta). Cron (pg_cron) yo'lida safeupdate yo'q — kubok o'zi oxiriga yetgan.
-- Tuzatish: 1) `where true`; 2) chempion aniqlangan bo'lsa darhol chiqish (ortiqcha ish yo'q).

CREATE OR REPLACE FUNCTION public.liga_cup_advance(p_group text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; arr uuid[]; k int; m int; p int; base time; nowt time;
begin
  perform pg_advisory_xact_lock(hashtext('liga_cup|' || p_group));
  if exists (select 1 from public.liga_day_cups c where c.day = td and c.group_code = p_group and c.champion is not null) then return; end if;
  select max(x.round) into r from public.liga_day_duels x where x.day = td and x.group_code = p_group;
  if r is null then return; end if;
  for d in select * from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r loop
    perform public.liga_live_tick(d.code);
    select * into l from public.liga_live where code = d.code;
    if l.status = 'done' and d.winner is null then
      w := case when l.a_pts > l.b_pts then l.a_id when l.b_pts > l.a_pts then l.b_id
                when l.a_pts > 0 and l.a_ms < l.b_ms then l.a_id when l.b_pts > 0 and l.b_ms < l.a_ms then l.b_id
                when random() < 0.5 then l.a_id else l.b_id end;
      update public.liga_day_duels set winner = w where day = d.day and code = d.code;
    end if;
  end loop;
  if exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r and x.winner is null) then return; end if;
  if exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r + 1) then return; end if;
  -- g'oliblar (va eski tartibdagi avtomatik o'tganlar) — ochko bo'yicha tartiblangan
  create temp table if not exists _cup_w(pl uuid, pts int, ms int, rk int) on commit drop;
  delete from _cup_w where true;
  insert into _cup_w(pl, pts, ms, rk)
  select z.pl, z.pts, z.ms, row_number() over (order by z.pts desc nulls last, z.ms asc nulls last, random())
  from (
    select x.winner pl, case when x.winner = x.a_id then l2.a_pts else l2.b_pts end pts,
           case when x.winner = x.a_id then l2.a_ms else l2.b_ms end ms
    from public.liga_day_duels x join public.liga_live l2 on l2.code = x.code
    where x.day = td and x.group_code = p_group and x.round = r
    union all
    select b.player_id, 1000, 0 from public.liga_day_byes b where b.day = td and b.group_code = p_group and b.round = r) z;
  select count(*) into m from _cup_w;
  if m <= 1 then
    update public.liga_day_cups set champion = (select pl from _cup_w limit 1) where day = td and group_code = p_group and champion is null;
    return;
  end if;
  p := public.liga_pow2_floor(m);
  if p < m then
    insert into public.liga_day_cut(day, group_code, round, player_id, pts, ms, keep, winners)
    select td, p_group, r, c.pl, c.pts, c.ms, p, m from _cup_w c where c.rk > p
    on conflict do nothing;
  end if;
  select array_agg(c.pl order by random()) into arr from _cup_w c where c.rk <= p;
  m := p;
  nowt := (now() at time zone 'Asia/Tashkent')::time;
  base := case when m = 2 then time '17:00' else public.liga_cup_round_time(r + 1) end;
  if (td + base) at time zone 'Asia/Tashkent' < now() + interval '5 minutes' then
    base := date_trunc('minute', nowt + interval '10 minutes')::time;
    base := base + make_interval(mins => (5 - extract(minute from base)::int % 5) % 5);
    if base > time '11:30' and base < time '14:00' then base := time '14:00'; end if;
  end if;
  k := 1;
  while k + 1 <= m loop
    perform public.liga_cup_new_duel(td, p_group, r + 1, (k + 1) / 2, arr[k], arr[k + 1], base);
    k := k + 2;
  end loop;
end $function$;
