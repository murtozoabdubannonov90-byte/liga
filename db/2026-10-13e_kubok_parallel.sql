-- 2026-10-13 · Kunlik duel kubogi — ko'p ishtirokchi uchun (60+ kishi)
-- * Bir raunddagi barcha duellar BIR VAQTDA (har o'yinchi raundda bitta duel o'ynaydi, ketma-ket qo'yish shart emas).
-- * 1-raundda to'g'ridan-to'g'ri o'tishlar (bye): keyingi raund 2 ning darajasi bo'lsin (64/32/16/8/4/2).
--   Masalan 60 kishi: 1-raund (saralash) 28 duel + 4 kishi avtomatik o'tadi → 1/16 final (32) → 1/8 (16) → chorak (8) → yarim (4) → final (2).
-- * Jadval: 1-raund 09:00, keyingilari har 40 daqiqada (30 daqiqa duel + 10 daqiqa oraliq), 13:00–14:00 tanaffus, FINAL 17:00.

create or replace function public.liga_cup_round_time(p_round int)
returns time language plpgsql immutable as $$
declare t time := time '09:00'; i int := 1;
begin
  while i < p_round loop
    t := t + interval '40 minutes';
    if t > time '12:30' and t < time '14:00' then t := time '14:00'; end if;
    i := i + 1;
  end loop;
  return least(t, time '16:20');
end $$;

-- raund nomi: duellar soniga qarab (2 ning darajasi bo'lmasa — saralash)
create or replace function public.liga_cup_stage(p_n integer, p_round integer)
returns text language sql immutable as $$
  select case p_n when 1 then 'final' when 2 then 'semi' when 4 then 'quarter' when 8 then 'r16' when 16 then 'r32' when 32 then 'r64'
    else case when p_n > 0 and (p_n & (p_n - 1)) = 0 then 'r' || (p_n * 2) else 'qual' end end
$$;

-- raund nomi o'yinchilar soniga qarab: 2 ning darajasi bo'lsa (64/32/16/8/4/2) — 1/32 … final, aks holda — saralash
create or replace function public.liga_cup_pstage(p_players integer)
returns text language sql immutable as $$
  select case when p_players > 1 and (p_players & (p_players - 1)) = 0 then public.liga_cup_stage(p_players / 2, 0) else 'qual' end
$$;

-- bugungi raund nomi (duellar + avtomatik o'tganlar hisobga olinadi)
create or replace function public.liga_cup_rstage(p_day date, p_group text, p_round integer)
returns text language sql stable security definer set search_path = public as $$
  select public.liga_cup_pstage(
    2 * (select count(*)::int from public.liga_day_duels z where z.day = p_day and z.group_code = p_group and z.round = p_round)
    + (select count(*)::int from public.liga_day_byes b where b.day = p_day and b.group_code = p_group and b.round = p_round))
$$;

-- ishtirokchilar soniga qarab kun jadvali (ilova va bot uchun)
create or replace function public.liga_cup_timetable(p_n int)
returns table(round int, stage text, duels int, at time) language plpgsql immutable as $$
declare p int := 1; r int := 1; s int;               -- s — raunddagi o'yinchilar
begin
  if p_n < 2 then return; end if;
  while p < p_n loop p := p * 2; end loop;
  s := p_n;
  while s >= 2 loop
    round := r; stage := public.liga_cup_pstage(s);
    duels := case when s = p_n then p_n - p / 2 else s / 2 end;
    at := case when s = 2 then time '17:00' else public.liga_cup_round_time(r) end;
    return next;
    s := case when s = p_n then p / 2 else s / 2 end;
    r := r + 1;
  end loop;
end $$;
grant execute on function public.liga_cup_timetable(int) to anon, authenticated;

create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; i int; n int; p int; nd int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      if n >= 2 then
        p := 1; while p < n loop p := p * 2; end loop;
        nd := n - p / 2;                                -- duellar soni; qolgan (p - n) kishi avtomatik o'tadi
        i := 1;
        while i <= nd loop
          perform public.liga_cup_new_duel(td, g.code, 1, i, ids[2 * i - 1], ids[2 * i],
            case when n = 2 then time '17:00' else public.liga_cup_round_time(1) end);
          i := i + 1;
        end loop;
        i := 2 * nd + 1;
        while i <= n loop
          insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, g.code, 1, nd + (i - 2 * nd), ids[i]);
          i := i + 1;
        end loop;
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
    if base > time '12:30' and base < time '14:00' then base := time '14:00'; end if;
  end if;
  k := 1;
  while k + 1 <= m loop
    perform public.liga_cup_new_duel(td, p_group, r + 1, (k + 1) / 2, arr[k], arr[k + 1], base);   -- raund duellari bir vaqtda
    k := k + 2;
  end loop;
  if m % 2 = 1 then insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m + 1) / 2, arr[m]) on conflict do nothing; end if;
end $$;

-- ilova: bugun 1-raundda avtomatik o'tganmi va kubok jadvali
create or replace function public.liga_cup_me2(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (select public.liga_my_group(p_id) code),
  n as (select (select count(*) from public.liga_day_duels d, g where d.day = public.liga_today() and d.group_code = g.code and d.round = 1) * 2
             + (select count(*) from public.liga_day_byes b, g where b.day = public.liga_today() and b.group_code = g.code and b.round = 1) cnt)
  select jsonb_build_object(
    'players', (select cnt from n),
    'bye', exists (select 1 from public.liga_day_byes b, g where b.day = public.liga_today() and b.group_code = g.code and b.player_id = p_id
                     and b.round = (select max(x.round) from public.liga_day_duels x, g g2 where x.day = public.liga_today() and x.group_code = g2.code)),
    'table', coalesce((select jsonb_agg(jsonb_build_object('round', t.round, 'stage', t.stage, 'duels', t.duels, 'at', to_char(t.at, 'HH24:MI')) order by t.round)
                       from n, public.liga_cup_timetable(n.cnt::int) t), '[]'::jsonb))
$$;
grant execute on function public.liga_cup_me2(uuid) to anon, authenticated;

-- bot: bugun avtomatik o'tganlar (ular uchun alohida xabar)
create or replace function public.liga_cup_byes_sys()
returns table(group_code text, player uuid, tg bigint, lang text, name text, round int)
language sql stable security definer set search_path = public as $$
  select b.group_code, b.player_id, s.tg_user_id, coalesce(s.lang, 'uz'), trim(coalesce(s.first_name,'') || ' ' || left(coalesce(s.last_name,''),1) || '.'), b.round
  from public.liga_day_byes b join public.safari_players s on s.id = b.player_id
  where b.day = public.liga_today() and b.round = 1
$$;
revoke all on function public.liga_cup_byes_sys() from public, anon, authenticated;

-- qolgan funksiyalarda raund nomi ham avtomatik o'tganlarni hisobga olsin (liga_cup_rstage)
do $do$
declare f text; def text; nd text;
begin
  foreach f in array array['liga_cup_board_sys','liga_cup_due_sys','liga_cup_list','liga_day_duel_me'] loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f;
    nd := regexp_replace(def,
      'public\.liga_cup_stage\(\(select count\(\*\)::int from public\.liga_day_duels z where z\.day = ([a-z_.]+) and z\.group_code = ([a-z_.]+) and z\.round = ([a-z_.]+)\), [a-z_.]+\)',
      'public.liga_cup_rstage(\1, \2, \3)', 'g');
    if nd = def then raise exception 'stage pattern not found in %', f; end if;
    execute nd;
  end loop;
end $do$;
revoke all on function public.liga_cup_rstage(date, text, integer) from public, anon, authenticated;
