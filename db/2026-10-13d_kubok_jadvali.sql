-- 2026-10-13 · Kunlik duel kubogi — yangi jadval (14.10.2026 dan)
-- 1-raund 09:00 dan, duellar ketma-ket har 30 daqiqada (har duel 30 daqiqa ochiq).
-- Keyingi raund oldingisi tugagach ~10 daqiqada boshlanadi (uzun tanaffus yo'q).
-- 13:00–14:00 — tushlik: bu oraliqqa duel qo'yilmaydi (oynasi shu vaqtga tegsa 14:00 ga suriladi).
-- Final har doim 17:00 da.

create or replace function public.liga_cup_slot(p_start time, p_k int)
returns time language plpgsql immutable as $$
-- p_start dan boshlab k-chi (0 dan) duel vaqti: 30 daqiqa qadam; oynasi 13:00–14:00 ga tegsa 14:00 ga suriladi; 16:30 dan oshmaydi
declare t time := p_start; i int := 0;
begin
  if t > time '12:30' and t < time '14:00' then t := time '14:00'; end if;
  while i < p_k loop
    t := t + interval '30 minutes';
    if t > time '12:30' and t < time '14:00' then t := time '14:00'; end if;
    i := i + 1;
  end loop;
  return least(t, time '16:30');
end $$;

create or replace function public.liga_cup_base(p_round integer)
returns time language sql immutable as $$ select time '09:00' $$;

create or replace function public.liga_cup_advance(p_group text)
returns void language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; ent record; arr uuid[]; poss int[]; k int; m int; base time; nowt time;
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
  arr := '{}'; poss := '{}';
  for ent in (select x.pos p, x.winner pl from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r
              union all select b.pos, b.player_id from public.liga_day_byes b where b.day = td and b.group_code = p_group and b.round = r) order by 1 loop
    arr := arr || ent.pl; poss := poss || ent.p;
  end loop;
  m := coalesce(array_length(arr, 1), 0);
  if m <= 1 then
    update public.liga_day_cups set champion = arr[1] where day = td and group_code = p_group and champion is null;
    return;
  end if;
  nowt := (now() at time zone 'Asia/Tashkent')::time;
  if m = 2 then
    base := time '17:00';                                    -- final har doim 17:00
  else
    -- oldingi raund tugagach ~10 daqiqada (5 daqiqaga yaxlitlab)
    base := date_trunc('minute', nowt + interval '10 minutes')::time;
    base := base + make_interval(mins => (5 - extract(minute from base)::int % 5) % 5);
    if base > time '12:30' and base < time '14:00' then base := time '14:00'; end if;
  end if;
  if (td + base) at time zone 'Asia/Tashkent' < now() + interval '5 minutes' then
    base := (date_trunc('minute', nowt + interval '10 minutes'))::time;
  end if;
  k := 1;
  while k + 1 <= m loop
    perform public.liga_cup_new_duel(td, p_group, r + 1, (k + 1) / 2, arr[k], arr[k + 1],
      case when m = 2 then base else public.liga_cup_slot(base, (k - 1) / 2) end);
    k := k + 2;
  end loop;
  if m % 2 = 1 then insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m + 1) / 2, arr[m]) on conflict do nothing; end if;
end $$;

-- 1-raund: 09:00 dan ketma-ket (tushlikni chetlab)
create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; i int; n int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      if n >= 2 then
        i := 1;
        while i + 1 <= n loop
          perform public.liga_cup_new_duel(td, g.code, 1, (i + 1) / 2, ids[i], ids[i + 1],
            case when n = 2 then time '17:00' else public.liga_cup_slot(public.liga_cup_base(1), (i - 1) / 2) end);
          i := i + 2;
        end loop;
        if n % 2 = 1 then insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, g.code, 1, (n + 1) / 2, ids[n]); end if;
        insert into public.liga_day_cups(day, group_code) values (td, g.code) on conflict do nothing;
        isnew := true;
      end if;
    end if;
    return query
      select g.code, d.code, d.slot, s.id, s.tg_user_id, coalesce(s.lang, 'uz'),
        trim(coalesce(s.first_name,'') || ' ' || left(coalesce(s.last_name,''),1) || '.'),
        trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.'),
        public.liga_cup_stage((select count(*)::int from public.liga_day_duels z where z.day = td and z.group_code = g.code and z.round = d.round), d.round), isnew
      from public.liga_day_duels d
      join public.safari_players s on s.id in (d.a_id, d.b_id)
      join public.safari_players o on o.id = case when s.id = d.a_id then d.b_id else d.a_id end
      where d.day = td and d.group_code = g.code and d.round = (select max(z.round) from public.liga_day_duels z where z.day = td and z.group_code = g.code)
      order by d.slot;
  end loop;
end $$;
