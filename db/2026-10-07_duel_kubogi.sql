-- 2026-10-07: kunlik duel kubogi (olimpiya tizimi), dushanba–juma
--  • 09:00 da ishtirokchilar tasodifiy juftlanadi: 1-bosqich (8 kishi — chorak final) 10:30 dan har 30 daqiqada.
--  • G'oliblar keyingi bosqichga: yarim final 14:00 dan, final 16:00. Har duel 1 soat ochiq, faqat provodka (10 savol).
--  • Durang yoki ikkalasi kelmasa — g'olib tasodifiy (qur'a). Toq son bo'lsa — bittasi keyingi bosqichga o'zi o'tadi.
--  • Bot: yangi bosqich juftlari, 5 daqiqa oldin, boshlanganda va kubok g'olibi haqida xabar beradi.

alter table public.liga_day_duels add column if not exists round int not null default 1;
alter table public.liga_day_duels add column if not exists pos int not null default 0;
alter table public.liga_day_duels add column if not exists winner uuid;
alter table public.liga_day_duels add column if not exists notified_pair boolean not null default false;

create table if not exists public.liga_day_byes(
  day date not null, group_code text not null, round int not null, pos int not null, player_id uuid not null,
  primary key (day, group_code, round, player_id));
alter table public.liga_day_byes enable row level security;

create table if not exists public.liga_day_cups(
  day date not null, group_code text not null, champion uuid, announced boolean not null default false,
  primary key (day, group_code));
alter table public.liga_day_cups enable row level security;

-- bosqich nomi: duellar soniga qarab
create or replace function public.liga_cup_stage(p_n int, p_round int) returns text language sql immutable as $$
  select case when p_n = 1 then 'final' when p_n = 2 then 'semi' when p_n = 4 then 'quarter' else 'r' || p_round end $$;

-- bosqich boshlanish soati: 1 — 10:30, 2 — 14:00, 3 — 16:00, keyingilari 16:30
create or replace function public.liga_cup_base(p_round int) returns time language sql immutable as $$
  select case p_round when 1 then '10:30'::time when 2 then '14:00'::time when 3 then '16:00'::time else '16:30'::time end $$;

-- bitta duel yaratish (ichki)
create or replace function public.liga_cup_new_duel(p_day date, p_group text, p_round int, p_pos int, p_a uuid, p_b uuid, p_slot time)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where liga_live.code = c); end loop;
  insert into public.liga_live(code, a_id, b_id, lang, qids, kind, win_from, win_to)
    values (c, p_a, p_b, (select case when sp.lang = 'ru' then 'ru' else 'uz' end from public.safari_players sp where sp.id = p_a),
            public.liga_draw(public.liga_all_pools(), 'day|' || c, 10, 0, 0, 0), 'day',
            (p_day + p_slot) at time zone 'Asia/Tashkent', (p_day + p_slot + interval '1 hour') at time zone 'Asia/Tashkent');
  insert into public.liga_day_duels(day, group_code, code, a_id, b_id, slot, round, pos, notified_pair)
    values (p_day, p_group, c, p_a, p_b, p_slot, p_round, p_pos, p_round = 1);
  return c;
end $$;

-- 1-bosqich: tasodifiy juftlar (bot 09:00 da; takror chaqirilsa — mavjudlar qaytadi)
create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
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
          perform public.liga_cup_new_duel(td, g.code, 1, (i + 1) / 2, ids[i], ids[i + 1], public.liga_cup_base(1) + make_interval(mins => 30 * ((i - 1) / 2)));
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

-- g'oliblar keyingi bosqichga (cron har 5 daqiqada; ilova ham chaqiradi)
create or replace function public.liga_cup_advance(p_group text)
returns void language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); r int; d record; l public.liga_live; w uuid; ent record; arr uuid[]; poss int[]; k int; m int; base time;
begin
  select max(x.round) into r from public.liga_day_duels x where x.day = td and x.group_code = p_group;
  if r is null then return; end if;
  -- shu bosqich duellari: holatni yangilash va g'olibni yozish
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
  -- keyingi bosqich ishtirokchilari: g'oliblar + o'zi o'tganlar (bracket tartibida)
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
  base := public.liga_cup_base(r + 1);
  -- kechikib qolsa — hozirdan 10 daqiqa keyin
  if (td + base) at time zone 'Asia/Tashkent' < now() + interval '10 minutes' then
    base := (date_trunc('minute', (now() at time zone 'Asia/Tashkent') + interval '10 minutes'))::time;
  end if;
  k := 1;
  while k + 1 <= m loop
    perform public.liga_cup_new_duel(td, p_group, r + 1, (k + 1) / 2, arr[k], arr[k + 1], base + make_interval(mins => 30 * ((k - 1) / 2)));
    k := k + 2;
  end loop;
  if m % 2 = 1 then insert into public.liga_day_byes(day, group_code, round, pos, player_id) values (td, p_group, r + 1, (m + 1) / 2, arr[m]) on conflict do nothing; end if;
end $$;

-- bot uchun xabarlar: pair — yangi bosqich jufti; five — 5 daqiqa qoldi; start — boshlandi; champ — kubok g'olibi (hammaga)
create or replace function public.liga_cup_due_sys()
returns table(kind text, code text, slot time, tg bigint, lang text, opp_name text, stage text, extra text, group_code text)
language plpgsql security definer set search_path = public as $$
declare g record; td date := public.liga_today();
begin
  for g in select distinct x.group_code gc from public.liga_day_duels x where x.day = td loop
    perform public.liga_cup_advance(g.gc);
  end loop;
  return query
  with nd as (
    update public.liga_day_duels d set notified_pair = true
    where d.day = td and not d.notified_pair
    returning 'pair'::text k, d.code, d.slot, d.a_id, d.b_id, d.round, d.group_code gc),
  five as (
    update public.liga_day_duels d set notified_5 = true
    where d.day = td and not d.notified_5 and not d.notified_start and d.notified_pair
      and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '6 minutes'
      and (d.day + d.slot) at time zone 'Asia/Tashkent' > now() + interval '1 minute'
    returning 'five'::text k, d.code, d.slot, d.a_id, d.b_id, d.round, d.group_code gc),
  st as (
    update public.liga_day_duels d set notified_start = true, notified_5 = true
    where d.day = td and not d.notified_start and d.notified_pair
      and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '1 minute'
      and (d.day + d.slot + interval '1 hour') at time zone 'Asia/Tashkent' > now()
    returning 'start'::text k, d.code, d.slot, d.a_id, d.b_id, d.round, d.group_code gc),
  allx as (select * from nd union all select * from five union all select * from st)
  select allx.k, allx.code, allx.slot, s.tg_user_id, coalesce(s.lang, 'uz'),
    trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.'),
    public.liga_cup_stage((select count(*)::int from public.liga_day_duels z where z.day = td and z.group_code = allx.gc and z.round = allx.round), allx.round),
    null::text, allx.gc
  from allx join public.safari_players s on s.id in (allx.a_id, allx.b_id)
  join public.safari_players o on o.id = case when s.id = allx.a_id then allx.b_id else allx.a_id end
  where s.tg_user_id is not null;
  -- kubok g'olibi: guruhdagi hammaga
  return query
  with ch as (
    update public.liga_day_cups c set announced = true
    where c.day = td and c.champion is not null and not c.announced
    returning c.group_code gc, c.champion)
  select 'champ'::text, null::text, null::time, s.tg_user_id, coalesce(s.lang, 'uz'), null::text, 'final'::text,
    (select trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) from public.safari_players p where p.id = ch.champion), ch.gc
  from ch join public.safari_players s on s.group_code = ch.gc
  where s.tg_user_id is not null and s.last_active > now() - interval '7 days';
end $$;

-- bugungi kubok jadvali (bot «hammaga jadval» uchun)
create or replace function public.liga_cup_board_sys()
returns table(group_code text, round int, stage text, slot time, a_name text, b_name text, status text, winner_name text)
language sql security definer set search_path = public as $$
  select d.group_code, d.round,
    public.liga_cup_stage((select count(*)::int from public.liga_day_duels z where z.day = d.day and z.group_code = d.group_code and z.round = d.round), d.round),
    d.slot,
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.a_id),
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.b_id),
    l.status,
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.winner)
  from public.liga_day_duels d join public.liga_live l on l.code = d.code
  where d.day = public.liga_today() order by d.group_code, d.round, d.slot
$$;
-- bugungi kubok ishtirokchilari (Telegram)
create or replace function public.liga_cup_people_sys()
returns table(group_code text, tg bigint, lang text, player uuid)
language sql security definer set search_path = public as $$
  select s.group_code, s.tg_user_id, coalesce(s.lang, 'uz'), s.id from public.safari_players s
  where s.tg_user_id is not null and s.group_code in (select distinct d.group_code from public.liga_day_duels d where d.day = public.liga_today())
    and s.last_active > now() - interval '7 days'
$$;

-- ilova: jadval (bosqich bilan)
create or replace function public.liga_cup_list(p_id uuid)
returns table(round int, stage text, slot text, a_name text, b_name text, a_pts int, b_pts int, status text, note text, mine boolean, winner_name text, champion text)
language plpgsql security definer set search_path = public as $$
declare g text := public.liga_my_group(p_id); ch text;
begin
  perform public.liga_cup_advance(g);
  select trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) into ch from public.liga_day_cups c join public.safari_players p on p.id = c.champion
    where c.day = public.liga_today() and c.group_code = g;
  return query select d.round,
    public.liga_cup_stage((select count(*)::int from public.liga_day_duels z where z.day = d.day and z.group_code = d.group_code and z.round = d.round), d.round),
    to_char(d.slot, 'HH24:MI'),
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.a_id),
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.b_id),
    l.a_pts, l.b_pts, l.status, l.note, p_id in (d.a_id, d.b_id),
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.winner), ch
  from public.liga_day_duels d join public.liga_live l on l.code = d.code
  where d.day = public.liga_today() and d.group_code = g order by d.round, d.slot;
end $$;

-- ilova: mening bugungi (oxirgi bosqichdagi) duelim
create or replace function public.liga_day_duel_me(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_day_duels; l public.liga_live; me text; o uuid; on_ text; st text;
begin
  perform public.liga_cup_advance(public.liga_my_group(p_id));
  select * into d from public.liga_day_duels where day = public.liga_today() and p_id in (a_id, b_id) order by round desc limit 1;
  if d.code is null then return null; end if;
  perform public.liga_live_tick(d.code);
  select * into l from public.liga_live where code = d.code;
  st := public.liga_cup_stage((select count(*)::int from public.liga_day_duels z where z.day = d.day and z.group_code = d.group_code and z.round = d.round), d.round);
  me := case when l.a_id = p_id then 'a' else 'b' end; o := case when me = 'a' then l.b_id else l.a_id end;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into on_ from public.safari_players where id = o;
  return jsonb_strip_nulls(jsonb_build_object('code', l.code, 'slot', to_char(d.slot, 'HH24:MI'), 'opp', on_, 'status', l.status, 'note', l.note, 'stage', st,
    'opens_in', case when now() < l.win_from then (extract(epoch from (l.win_from - now())) * 1000)::int end,
    'open', now() >= l.win_from and now() <= l.win_to, 'closed', now() > l.win_to,
    'my_pts', case when me = 'a' then l.a_pts else l.b_pts end, 'opp_pts', case when me = 'a' then l.b_pts else l.a_pts end,
    'won', case when d.winner is not null then d.winner = p_id when l.status = 'done' then (case when me = 'a' then l.a_pts > l.b_pts else l.b_pts > l.a_pts end) end,
    'tie', case when l.status = 'done' and d.winner is null then l.a_pts = l.b_pts end));
end $$;

-- cron: avval bosqichlarni yangilaydi, keyin xabar kerak bo'lsa botni chaqiradi (09:00–17:59)
create or replace function public.liga_day_duel_tick() returns void language plpgsql security definer set search_path = public as $$
declare g record; td date := public.liga_today();
begin
  for g in select distinct x.group_code gc from public.liga_day_duels x where x.day = td loop
    perform public.liga_cup_advance(g.gc);
  end loop;
  if exists (select 1 from public.liga_day_duels d where d.day = td and (not d.notified_pair
       or (not d.notified_5 and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '6 minutes'
           and (d.day + d.slot + interval '1 hour') at time zone 'Asia/Tashkent' > now())
       or (not d.notified_start and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '1 minute'
           and (d.day + d.slot + interval '1 hour') at time zone 'Asia/Tashkent' > now())))
     or exists (select 1 from public.liga_day_cups c where c.day = td and c.champion is not null and not c.announced) then
    perform public.liga_bot_call('duel_due');
  end if;
end $$;
select cron.schedule('liga-juft-duel', '*/5 4-12 * * 1-5', $$select public.liga_day_duel_tick()$$);

-- bugungi hali boshlanmagan duellarni chetga olish (arxiv: sana 2000-01-01, holat «bekor»), keyin kubokni qaytadan tuzish mumkin
create or replace function public.liga_cup_reset_today_sys() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.liga_live l set status = 'done', note = 'cancel', finished_at = now()
    from public.liga_day_duels d where d.code = l.code and d.day = public.liga_today() and l.status = 'wait';
  update public.liga_day_duels d set day = date '2000-01-01', notified_pair = true, notified_5 = true, notified_start = true
    where d.day = public.liga_today() and exists (select 1 from public.liga_live l where l.code = d.code and l.note = 'cancel');
  get diagnostics n = row_count;
  update public.liga_day_byes set day = date '2000-01-01' where day = public.liga_today();
  update public.liga_day_cups set day = date '2000-01-01', announced = true where day = public.liga_today();
  return n;
end $$;
-- 2026-10-07 09:59 da bajarildi: select liga_cup_reset_today_sys(); keyin bot «cup_schedule» — jadval hammaga yuborildi

revoke all on function public.liga_cup_new_duel(date, text, int, int, uuid, uuid, time), public.liga_cup_start_sys(), public.liga_cup_due_sys(),
  public.liga_cup_board_sys(), public.liga_cup_people_sys(), public.liga_cup_reset_today_sys(), public.liga_day_duel_tick(), public.liga_cup_advance(text) from public, anon, authenticated;
grant execute on function public.liga_cup_start_sys(), public.liga_cup_due_sys(), public.liga_cup_board_sys(), public.liga_cup_people_sys() to service_role;
grant execute on function public.liga_cup_list(uuid), public.liga_day_duel_me(uuid) to anon, authenticated;

-- 10:15 o'zgarish (migratsiya liga_kubok_15_90_30): 15 ta provodka, har savolga 90 soniya, duel 30 daqiqa ochiq.
-- liga_live_qsec() = 90; liga_cup_new_duel: liga_draw(..., 15, 0, 0, 0), win_to = slot + 30 daqiqa;
-- liga_cup_due_sys / liga_day_duel_tick: oyna 30 daqiqa; liga_cup_upgrade_today_sys(): bugungi kutilayotgan duellarni 15 savol/30 daqiqaga o'tkazdi.
