-- 2026-10-21 · Kubok: «eng yaxshi yutqazgan»ni qaytarish bekor qilindi (noroziliklar). Yutqazgan hech qachon keyingi raundga o'tmaydi.
-- Yangi tartib (2026-10-22 dan): ishtirokchilar soni n; P — n dan oshmaydigan eng katta 2 ning darajasi (2, 4, 8 … 128, 256).
--   n = P bo'lsa — oddiy olimpiya tizimi.
--   n > P bo'lsa — 1-raund «Saralash»: (n − P) ta duel, ularda eng kam ballilar o'ynaydi; qolgan (2P − n) kishi
--   (oxirgi 7 kundagi bosqich bali eng yuqorilar) saralashsiz 2-raundga o'tadi. 2-raunddan boshlab soni doim P, P/2 … — hech qachon toq emas.
--   Misol: 150 kishi → saralash 22 duel (44 kishi), 106 kishi to'g'ridan-to'g'ri → 128 → 64 → 32 → 16 → 8 → 4 → final.
-- Toq ishtirokchilar sonida oxirgi qo'shilganni chetlatish (2026-10-15e) endi kerak emas — hamma qatnashadi.

create or replace function public.liga_pow2_floor(p int) returns int language sql immutable as $$
  select case when p < 1 then 0 else (2 ^ floor(log(2, p::numeric)))::int end
$$;

-- bosqich nomi: raunddagi o'yinchilar soni 2 ning darajasi bo'lmasa — saralash
create or replace function public.liga_cup_rstage(p_day date, p_group text, p_round integer)
returns text language sql stable security definer set search_path = public as $$
  with c as (select 2 * (select count(*)::int from public.liga_day_duels z where z.day = p_day and z.group_code = p_group and z.round = p_round)
                  + (select count(*)::int from public.liga_day_byes b where b.day = p_day and b.group_code = p_group and b.round = p_round) n)
  select case when c.n > 2 and c.n <> public.liga_pow2_floor(c.n) then 'qual' else public.liga_cup_pstage(c.n) end from c
$$;

create or replace function public.liga_cup_timetable(p_n integer)
returns table(round integer, stage text, duels integer, at time without time zone)
language plpgsql immutable as $$
declare r int := 1; p int := public.liga_pow2_floor(p_n); s int;
begin
  if p_n < 2 then return; end if;
  if p_n > p then
    round := 1; stage := 'qual'; duels := p_n - p; at := public.liga_cup_round_time(1); return next;
    r := 2;
  end if;
  s := p;
  while s >= 2 loop
    round := r; stage := public.liga_cup_pstage(s); duels := s / 2;
    at := case when s = 2 then time '17:00' else public.liga_cup_round_time(r) end;
    return next;
    s := s / 2; r := r + 1;
  end loop;
end $$;

create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; play uuid[]; i int; n int; p int; ex int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    perform pg_advisory_xact_lock(hashtext('liga_cup|' || g.code));
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      -- reyting: oxirgi 7 kundagi bosqich bali (yuqoridan pastga), teng bo'lsa — tasodifiy
      select array_agg(z.id order by z.pts desc, random()) into ids from (
        select s.id, coalesce((select sum(r.gain + coalesce(r.bonus, 0)) from public.liga_runs r
                               where r.kind = 'stage' and r.player_id = s.id and r.started_at > now() - interval '7 days'), 0) pts
        from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id)) z;
      n := coalesce(array_length(ids, 1), 0);
      if n >= 2 then
        p := public.liga_pow2_floor(n); ex := n - p;
        if ex = 0 then
          select array_agg(u order by random()) into play from unnest(ids) u;
          i := 1;
          while i <= n / 2 loop
            perform public.liga_cup_new_duel(td, g.code, 1, i, play[2 * i - 1], play[2 * i],
              case when n = 2 then time '17:00' else public.liga_cup_round_time(1) end);
            i := i + 1;
          end loop;
        else
          -- saralashsiz o'tadiganlar: reytingdagi birinchi (p − ex) kishi
          i := 1;
          while i <= p - ex loop
            insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, g.code, 1, i, ids[i]) on conflict do nothing;
            i := i + 1;
          end loop;
          -- saralash: qolgan 2·ex kishi tasodifiy juftlanadi
          select array_agg(u order by random()) into play from unnest(ids[p - ex + 1 : n]) u;
          i := 1;
          while i <= ex loop
            perform public.liga_cup_new_duel(td, g.code, 1, i, play[2 * i - 1], play[2 * i], public.liga_cup_round_time(1));
            i := i + 1;
          end loop;
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

-- keyingi raund: faqat g'oliblar (+ saralashsiz o'tganlar). Yutqazgan qaytarilmaydi.
-- Favqulodda toq son chiqsa (yangi tartibda bo'lmaydi) — eng ko'p ochko olgan g'olib keyingi raundga avtomatik o'tadi.
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
  if m % 2 = 1 then
    select z.winner into lucky from (
      select x.winner, case when x.winner = x.a_id then l2.a_pts else l2.b_pts end pts, case when x.winner = x.a_id then l2.a_ms else l2.b_ms end ms
      from public.liga_day_duels x join public.liga_live l2 on l2.code = x.code
      where x.day = td and x.group_code = p_group and x.round = r) z
    order by z.pts desc, z.ms asc nulls last, random() limit 1;
    if lucky is null then lucky := arr[m]; end if;
    arr := array_remove(arr, lucky);
    m := m - 1;
    insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m / 2) + 1, lucky) on conflict do nothing;
  end if;
  nowt := (now() at time zone 'Asia/Tashkent')::time;
  base := case when m = 2 and not exists (select 1 from public.liga_day_byes b where b.day = td and b.group_code = p_group and b.round = r + 1)
               then time '17:00' else public.liga_cup_round_time(r + 1) end;
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
end $$;
