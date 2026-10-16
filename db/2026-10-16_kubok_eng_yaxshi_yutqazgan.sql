-- 2026-10-16 · Kubokda hech bir raundda juftsiz odam qolmasin.
-- 1-raund: toq bo'lsa oxirgi qo'shilgan kubokdan chetda (2026-10-15e).
-- Keyingi raundlar: g'oliblar soni toq chiqsa (masalan 30 → 15), avtomatik o'tish o'rniga shu raundning
-- «eng yaxshi yutqazgan»i qaytariladi — eng ko'p ochko yig'gan, teng bo'lsa tezroq javob bergan yutqazuvchi. Shunda soni doim juft.
-- 240 → 120 → 60 → 30 → 15+1=16 → 8 → 4 → 2 → final.

create or replace function public.liga_cup_timetable(p_n integer)
returns table(round integer, stage text, duels integer, at time without time zone)
language plpgsql immutable as $$
declare r int := 1; s int := p_n - (p_n % 2);
begin
  if s < 2 then return; end if;
  while s >= 2 loop
    round := r; stage := public.liga_cup_pstage(s); duels := s / 2;
    at := case when s = 2 then time '17:00' else public.liga_cup_round_time(r) end;
    return next;
    s := s / 2; if s > 1 and s % 2 = 1 then s := s + 1; end if;
    r := r + 1;
  end loop;
end $$;

create or replace function public.liga_cup_advance(p_group text)
returns void language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; arr uuid[]; lucky uuid; k int; m int; base time; nowt time;
begin
  perform pg_advisory_xact_lock(hashtext('liga_cup|' || p_group));
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
  select array_agg(pl order by random()) into arr from (
    select x.winner pl from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r
    union all select b.player_id from public.liga_day_byes b where b.day = td and b.group_code = p_group and b.round = r) z;
  m := coalesce(array_length(arr, 1), 0);
  if m <= 1 then
    update public.liga_day_cups set champion = arr[1] where day = td and group_code = p_group and champion is null;
    return;
  end if;
  -- toq: shu raundning eng yaxshi yutqazgani qaytariladi (o'ynagan, eng ko'p ochko, keyin eng tez)
  if m % 2 = 1 then
    select z.loser into lucky from (
      select case when x.winner = x.a_id then x.b_id else x.a_id end loser,
             case when x.winner = x.a_id then l2.b_pts else l2.a_pts end pts,
             case when x.winner = x.a_id then l2.b_ms else l2.a_ms end ms,
             coalesce(l2.note, '') note
      from public.liga_day_duels x join public.liga_live l2 on l2.code = x.code
      where x.day = td and x.group_code = p_group and x.round = r) z
    where z.loser is not null and not (z.loser = any(arr))
    order by (z.note in ('forfeit', 'cancel', 'idle2')) , z.pts desc, case when z.pts > 0 then z.ms end asc nulls last, random()
    limit 1;
    if lucky is not null then arr := arr || lucky; m := m + 1; end if;
  end if;
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
  -- (lucky topilmasa — juda kam holat) oxirgi kishi avtomatik o'tadi
  if m % 2 = 1 then
    insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m + 1) / 2, arr[m]) on conflict do nothing;
  end if;
end $$;
