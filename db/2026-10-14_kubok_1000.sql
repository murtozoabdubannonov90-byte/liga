-- 2026-10-13 kech · Kubok jadvali: 1-raund 10:00 da, 12:00–14:00 — o'yin yo'q (duel oynasi shu oraliqqa tegsa 14:00 ga suriladi), final 17:00.
-- Juftlar avvalgidek 09:00 da tuziladi va bot orqali e'lon qilinadi (1 soat oldin).
-- 60 kishi: saralash 10:00 → 1/16 10:40 → 1/8 11:20 → chorak 14:00 → yarim 14:40 → final 17:00.

create or replace function public.liga_cup_round_time(p_round int)
returns time language plpgsql immutable as $$
declare t time := time '10:00'; i int := 1;
begin
  while i < p_round loop
    t := t + interval '40 minutes';
    if t > time '11:30' and t < time '14:00' then t := time '14:00'; end if;   -- 30 daqiqalik duel 12:00 dan oshmasin
    i := i + 1;
  end loop;
  return least(t, time '16:20');
end $$;

create or replace function public.liga_cup_advance(p_group text)
returns void language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; ent record; arr uuid[]; k int; m int; base time; nowt time;
begin
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
  arr := '{}';
  for ent in (select x.pos p, x.winner pl from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r
              union all select b.pos, b.player_id from public.liga_day_byes b where b.day = td and b.group_code = p_group and b.round = r) order by 1 loop
    arr := arr || ent.pl;
  end loop;
  m := coalesce(array_length(arr, 1), 0);
  if m <= 1 then
    update public.liga_day_cups set champion = arr[1] where day = td and group_code = p_group and champion is null;
    return;
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
  if m % 2 = 1 then insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m + 1) / 2, arr[m]) on conflict do nothing; end if;
end $$;
