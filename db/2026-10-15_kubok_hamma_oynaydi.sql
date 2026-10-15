-- 2026-10-15 · Kubok: hamma 1-raunddan o'ynaydi.
-- Muammo: 132 ishtirokchida setka 128 ga moslanardi — faqat 4 ta saralash dueli bo'lib, 124 kishi 1-raunddan avtomatik o'tib ketardi.
-- Yechim: har raundda hamma o'ynaydi (n/2 duel). Toq bo'lsa — faqat 1 kishi o'tadi; u tasodifiy tanlanadi va bugun avval o'tmagan bo'ladi.
-- 132 → 66 → 33 → 17 → 9 → 5 → 3 → 2 → final (8 raund, 10:00 dan 17:00 gacha).
-- Raund nomi: o'yinchilar sonidan kattaroq eng yaqin 2 ning darajasi bo'yicha (132 → «1/128 final», 5 → «chorak final», 3 → «yarim final»).

create or replace function public.liga_cup_pstage(p_players integer)
returns text language plpgsql immutable as $$
declare p int := 1;
begin
  if p_players <= 2 then return 'final'; end if;
  while p < p_players loop p := p * 2; end loop;
  return public.liga_cup_stage(p / 2, 0);
end $$;

create or replace function public.liga_cup_timetable(p_n integer)
returns table(round integer, stage text, duels integer, at time without time zone)
language plpgsql immutable as $$
declare r int := 1; s int := p_n;
begin
  if p_n < 2 then return; end if;
  while s >= 2 loop
    round := r; stage := public.liga_cup_pstage(s); duels := s / 2;
    at := case when s = 2 then time '17:00' else public.liga_cup_round_time(r) end;
    return next;
    s := (s + 1) / 2; r := r + 1;
  end loop;
end $$;

-- 1-raund: hamma juftlanadi, toq bo'lsa bitta kishi o'tadi
create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; i int; n int; nd int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    perform pg_advisory_xact_lock(hashtext('liga_cup|' || g.code));
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      if n >= 2 then
        nd := n / 2;
        i := 1;
        while i <= nd loop
          perform public.liga_cup_new_duel(td, g.code, 1, i, ids[2 * i - 1], ids[2 * i],
            case when n = 2 then time '17:00' else public.liga_cup_round_time(1) end);
          i := i + 1;
        end loop;
        if n % 2 = 1 then
          insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, g.code, 1, nd + 1, ids[n]);
        end if;
        insert into public.liga_day_cups(day, group_code) values (td, g.code) on conflict do nothing;
        isnew := true;
      end if;
    end if;
    return query
      select g.code, d.code, d.slot, s.id, s.tg_user_id, coalesce(s.lang, 'uz'),
        trim(coalesce(s.first_name,'') || ' ' || left(coalesce(s.last_name,''),1) || '.'),
        trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.'),
        public.liga_cup_rstage(td, g.code, d.round), isnew
      from public.liga_day_duels d
      join public.safari_players s on s.id in (d.a_id, d.b_id)
      join public.safari_players o on o.id = case when s.id = d.a_id then d.b_id else d.a_id end
      where d.day = td and d.group_code = g.code and d.round = (select max(z.round) from public.liga_day_duels z where z.day = td and z.group_code = g.code)
      order by d.slot;
  end loop;
end $$;

-- keyingi raund: g'oliblar tasodifiy juftlanadi; toq bo'lsa o'tadigan kishi — bugun hali o'tmaganlar ichidan tasodifiy
create or replace function public.liga_cup_advance(p_group text)
returns void language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; arr uuid[]; byep uuid; k int; m int; base time; nowt time;
begin
  -- bir vaqtda bir necha joydan chaqirilsa (cron, ilova) — raund ikki marta tuzilmasin
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
  if m % 2 = 1 then
    select p into byep from unnest(arr) p
      where not exists (select 1 from public.liga_day_byes b where b.day = td and b.group_code = p_group and b.player_id = p)
      order by random() limit 1;
    byep := coalesce(byep, arr[m]);
    arr := array_remove(arr, byep);
  end if;
  nowt := (now() at time zone 'Asia/Tashkent')::time;
  base := case when m = 2 then time '17:00' else public.liga_cup_round_time(r + 1) end;
  if (td + base) at time zone 'Asia/Tashkent' < now() + interval '5 minutes' then
    base := date_trunc('minute', nowt + interval '10 minutes')::time;
    base := base + make_interval(mins => (5 - extract(minute from base)::int % 5) % 5);
    if base > time '11:30' and base < time '14:00' then base := time '14:00'; end if;
  end if;
  k := 1;
  while k + 1 <= coalesce(array_length(arr, 1), 0) loop
    perform public.liga_cup_new_duel(td, p_group, r + 1, (k + 1) / 2, arr[k], arr[k + 1], base);
    k := k + 2;
  end loop;
  if byep is not null then
    insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m + 1) / 2, byep) on conflict do nothing;
  end if;
end $$;
