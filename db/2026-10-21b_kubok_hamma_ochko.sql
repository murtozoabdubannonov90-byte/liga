-- 2026-10-21b · Kubok (Murtozo tanlovi): saralashsiz o'tish YO'Q — hamma 1-raundda o'ynaydi.
-- Har raundda faqat g'oliblar o'tadi (yutqazgan hech qachon qaytmaydi). G'oliblar soni 2 ning darajasi bo'lmasa
-- (masalan 290 → 145), keyingi bosqichga ochkosi eng ko'p P ta g'olib o'tadi (145 → 128), teng ochkoda — tezroq.
-- Qolgan g'oliblar «ochko bo'yicha chiqib qoldi» (liga_day_cut) — bot shaxsan xabar beradi. Keyingi raundlarda soni doim juft.
-- Ishtirokchilar soni toq bo'lsa — eng oxirgi qo'shilgan bugun kubokda emas (2026-10-15 qoidasi, «ertadan»).

create table if not exists public.liga_day_cut(
  day date not null, group_code text not null, round int not null, player_id uuid not null,
  pts int, ms int, keep int, winners int, notified boolean not null default false,
  primary key (day, group_code, round, player_id)
);
alter table public.liga_day_cut enable row level security;

create or replace function public.liga_cup_rstage(p_day date, p_group text, p_round integer)
returns text language sql stable security definer set search_path = public as $$
  with c as (select 2 * (select count(*)::int from public.liga_day_duels z where z.day = p_day and z.group_code = p_group and z.round = p_round)
                  + (select count(*)::int from public.liga_day_byes b where b.day = p_day and b.group_code = p_group and b.round = p_round) n)
  select case when c.n > 2 and c.n <> public.liga_pow2_floor(c.n) then 'qual' else public.liga_cup_pstage(c.n) end from c
$$;

-- jadval: 1-raund — hamma (juft son); keyin g'oliblar 2 ning darajasigacha (ochko bo'yicha)
create or replace function public.liga_cup_timetable(p_n integer)
returns table(round integer, stage text, duels integer, at time without time zone)
language plpgsql immutable as $$
declare r int := 1; s int := p_n - (p_n % 2);
begin
  if s < 2 then return; end if;
  while s >= 2 loop
    round := r; duels := s / 2;
    stage := case when s > 2 and s <> public.liga_pow2_floor(s) then 'qual' else public.liga_cup_pstage(s) end;
    at := case when s = 2 then time '17:00' else public.liga_cup_round_time(r) end;
    return next;
    s := public.liga_pow2_floor(s / 2); if s < 2 then exit; end if;
    r := r + 1;
  end loop;
end $$;

create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; last_id uuid; i int; n int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    perform pg_advisory_xact_lock(hashtext('liga_cup|' || g.code));
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      if n % 2 = 1 and n >= 3 then
        select s.id into last_id from public.safari_players s where s.id = any(ids) order by s.created_at desc nulls last, s.id desc limit 1;
        ids := array_remove(ids, last_id);
        insert into public.liga_day_bench(day, group_code, player_id) values (td, g.code, last_id) on conflict do nothing;
        n := n - 1;
      end if;
      if n >= 2 then
        i := 1;
        while i <= n / 2 loop
          perform public.liga_cup_new_duel(td, g.code, 1, i, ids[2 * i - 1], ids[2 * i],
            case when n = 2 then time '17:00' else public.liga_cup_round_time(1) end);
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
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; arr uuid[]; k int; m int; p int; base time; nowt time;
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
  if exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = p_group and x.round = r + 1) then return; end if;
  -- g'oliblar (va eski tartibdagi avtomatik o'tganlar) — ochko bo'yicha tartiblangan
  create temp table if not exists _cup_w(pl uuid, pts int, ms int, rk int) on commit drop;
  delete from _cup_w;
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
end $$;

-- bot: ochko bo'yicha chiqib qolgan g'oliblar (bir marta xabar)
create or replace function public.liga_cup_cut_due_sys()
returns table(tg bigint, lang text, name text, group_code text, round int, stage text, pts int, keep int, winners int)
language sql security definer set search_path = public as $$
  with u as (
    update public.liga_day_cut c set notified = true
    where c.day = public.liga_today() and not c.notified
    returning c.*)
  select s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name, u.group_code, u.round, public.liga_cup_rstage(u.day, u.group_code, u.round), u.pts, u.keep, u.winners
  from u join public.safari_players s on s.id = u.player_id
  where s.tg_user_id is not null
$$;
-- guruh/kanal uchun: raund bo'yicha chiqib qolganlar ro'yxati
create or replace function public.liga_cup_cut_list_sys(p_group text, p_round int)
returns table(name text, pts int, keep int, winners int)
language sql stable security definer set search_path = public as $$
  select public.liga_pname(c.player_id), c.pts, c.keep, c.winners from public.liga_day_cut c
  where c.day = public.liga_today() and c.group_code = p_group and c.round = p_round order by c.pts desc nulls last
$$;
revoke all on function public.liga_cup_cut_due_sys(), public.liga_cup_cut_list_sys(text, int) from public, anon, authenticated;
grant execute on function public.liga_cup_cut_due_sys(), public.liga_cup_cut_list_sys(text, int) to service_role;

-- ilova: mening dueli — ochko bo'yicha chiqib qolgan bo'lsa «cut»
create or replace function public.liga_day_duel_me(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_day_duels; l public.liga_live; me text; o uuid; on_ text; st text; ct public.liga_day_cut;
begin
  perform public.liga_cup_try_advance(public.liga_my_group(p_id));
  select * into d from public.liga_day_duels where day = public.liga_today() and p_id in (a_id, b_id) order by round desc limit 1;
  if d.code is null then return null; end if;
  perform public.liga_live_tick(d.code);
  select * into l from public.liga_live where code = d.code;
  select * into ct from public.liga_day_cut c where c.day = d.day and c.group_code = d.group_code and c.round = d.round and c.player_id = p_id;
  st := public.liga_cup_rstage(d.day, d.group_code, d.round);
  me := case when l.a_id = p_id then 'a' else 'b' end; o := case when me = 'a' then l.b_id else l.a_id end;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into on_ from public.safari_players where id = o;
  return jsonb_strip_nulls(jsonb_build_object('round', d.round, 'code', l.code, 'slot', to_char(d.slot, 'HH24:MI'), 'opp', on_, 'status', l.status, 'note', l.note, 'stage', st,
    'opens_in', case when now() < l.win_from then (extract(epoch from (l.win_from - now())) * 1000)::int end,
    'open', now() >= l.win_from and now() <= l.win_to, 'closed', now() > l.win_to,
    'my_pts', case when me = 'a' then l.a_pts else l.b_pts end, 'opp_pts', case when me = 'a' then l.b_pts else l.a_pts end,
    'won', case when d.winner is not null then d.winner = p_id when l.status = 'done' then (case when me = 'a' then l.a_pts > l.b_pts else l.b_pts > l.a_pts end) end,
    'tie', case when l.status = 'done' and d.winner is null then l.a_pts = l.b_pts end,
    'cut', case when ct.player_id is not null then true end, 'cut_keep', ct.keep, 'cut_winners', ct.winners));
end $$;
