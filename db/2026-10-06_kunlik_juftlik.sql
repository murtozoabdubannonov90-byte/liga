-- 2026-10-06: kunlik juftlik dueli
--  • Har ish kuni 09:00 da jamoa ishtirokchilari kechagi bosqich natijasi bo'yicha saralanadi
--    (teng bo'lsa — tasodifiy) va yonma-yon turganlar juftlanadi: 1–2, 3–4, ... — kuchi yaqin raqiblar.
--  • Har juftga tasodifiy soat beriladi; duel shu soatdan 1 soat davomida ochiq, kuniga 1 marta.
--  • Faqat provodka savollari (10 ta), jonli duel qoidasi: kim birinchi to'g'ri topsa.
--  • Bot ertalab har kimga raqibi va soatini, vaqt kelganda «Duel boshlandi» xabarini yuboradi.
--  • Belgilangan soatda kelmagan o'yinchi yutqazadi (ikkalasi kelmasa — o'ynalmagan).

alter table public.liga_live add column if not exists kind text not null default 'free';
alter table public.liga_live add column if not exists win_from timestamptz;
alter table public.liga_live add column if not exists win_to timestamptz;
alter table public.liga_live add column if not exists note text;

create table if not exists public.liga_day_duels(
  day date not null, group_code text not null, code text not null references public.liga_live(code) on delete cascade,
  a_id uuid not null, b_id uuid not null, slot time not null, notified_start boolean not null default false,
  primary key (day, code));
alter table public.liga_day_duels enable row level security;
create index if not exists liga_day_duels_g on public.liga_day_duels(group_code, day);

-- vaqt bo'yicha holat: jadvaldagi duel o'z soatidan oldin boshlanmaydi; soati o'tib ketsa — kelmagan yutqazadi
create or replace function public.liga_live_tick(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.liga_live; i int := 0;
begin
  select * into d from public.liga_live where code = p_code for update;
  if d.code is null then return; end if;
  if d.status = 'wait' and d.win_to is not null and now() > d.win_to then
    update public.liga_live set status = 'done', finished_at = now(),
      a_pts = case when d.a_seen >= d.win_from then 1 else 0 end, b_pts = case when d.b_seen >= d.win_from then 1 else 0 end,
      note = case when d.a_seen >= d.win_from and d.b_seen >= d.win_from then 'cancel'
                  when d.a_seen >= d.win_from or d.b_seen >= d.win_from then 'forfeit' else 'cancel' end
    where code = p_code;
    return;
  end if;
  if d.status = 'wait' and d.b_id is not null and (d.win_from is null or now() >= d.win_from)
     and d.a_seen > now() - interval '5 seconds' and d.b_seen > now() - interval '5 seconds' then
    update public.liga_live set status = 'play', started_at = now(), cur = 0, q_at = now() + interval '4 seconds' where code = p_code;
    return;
  end if;
  while d.status = 'play' and now() > d.q_at + make_interval(secs => public.liga_live_qsec()) and i < 12 loop
    perform public.liga_live_next(p_code, null);
    select * into d from public.liga_live where code = p_code; i := i + 1;
  end loop;
end $$;

-- ko'rinish: jadval ma'lumoti qo'shiladi (kind, ochilish vaqti, yopilish vaqti, izoh)
create or replace function public.liga_live_view2(p_code text, p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.liga_live_view(p_code, p_id) || jsonb_strip_nulls(jsonb_build_object('kind', l.kind, 'note', l.note,
    'opens_in', case when l.win_from is not null and now() < l.win_from then (extract(epoch from (l.win_from - now())) * 1000)::int end,
    'win_from', l.win_from, 'win_to', l.win_to))
  from public.liga_live l where l.code = p_code
$$;

create or replace function public.liga_live_state(p_id uuid, p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_live; c text := upper(trim(p_code));
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_live where code = c for update;
  if d.code is null then raise exception 'not_found'; end if;
  if d.a_id = p_id then update public.liga_live set a_seen = now() where code = c;
  elsif d.b_id = p_id then update public.liga_live set b_seen = now() where code = c;
  elsif d.b_id is null then
    if d.created_at < now() - interval '2 days' then raise exception 'duel_expired'; end if;
    update public.liga_live set b_id = p_id, b_seen = now() where code = c;
  end if;
  perform public.liga_live_tick(c);
  return public.liga_live_view2(c, p_id);
end $$;

create or replace function public.liga_live_answer(p_id uuid, p_token text, p_code text, p_k int, p_ans jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_live; c text := upper(trim(p_code)); side text; b public.liga_bank; ok boolean; why text := ''; ms int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  perform public.liga_live_tick(c);
  select * into d from public.liga_live where code = c for update;
  if d.code is null then raise exception 'not_found'; end if;
  side := case when p_id = d.a_id then 'a' when p_id = d.b_id then 'b' end;
  if side is null then raise exception 'duel_taken'; end if;
  if d.status <> 'play' or p_k is distinct from d.cur or now() < d.q_at then
    why := 'late';
  elsif (side = 'a' and d.a_lock = d.cur) or (side = 'b' and d.b_lock = d.cur) then
    why := 'locked';
  else
    select * into b from public.liga_bank where id = d.qids[d.cur + 1];
    ok := public.liga_q_ok(b, coalesce(p_ans, '{}'::jsonb));
    if ok then
      ms := (extract(epoch from (now() - d.q_at)) * 1000)::int;
      if side = 'a' then update public.liga_live set a_pts = a_pts + 1, a_ms = a_ms + ms where code = c;
      else update public.liga_live set b_pts = b_pts + 1, b_ms = b_ms + ms where code = c; end if;
      perform public.liga_live_next(c, side);
    else
      why := 'wrong';
      if side = 'a' then update public.liga_live set a_lock = d.cur where code = c; else update public.liga_live set b_lock = d.cur where code = c; end if;
      if (side = 'a' and d.b_lock = d.cur) or (side = 'b' and d.a_lock = d.cur) then perform public.liga_live_next(c, null); end if;
    end if;
  end if;
  return public.liga_live_view2(c, p_id) || jsonb_build_object('ok', coalesce(ok, false), 'why', why);
end $$;

-- juftlash (bot 09:00 da chaqiradi; takror chaqirilsa — mavjud juftlar qaytadi)
create or replace function public.liga_day_pair_sys()
returns table(group_code text, code text, slot time, player uuid, tg bigint, lang text, first_name text, opp_name text, opp_score int, my_score int, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); pd date := public.liga_prev_workday(public.liga_today()); g record; ids uuid[]; slots time[]; i int; c text; t time; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      -- ishtirokchilar: faol (7 kunda kirgan), obunasi bor; kechagi bosqich bali bo'yicha, teng bo'lsa tasodifiy
      select array_agg(p.id order by p.sc desc, random()) into ids from (
        select s.id, coalesce((select max(r.gain + r.bonus) from public.liga_runs r where r.kind = 'stage' and r.player_id = s.id
                               and (r.started_at at time zone 'Asia/Tashkent')::date = pd), 0) sc
        from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id)) p;
      if coalesce(array_length(ids, 1), 0) >= 2 then
        -- soatlar: dushanba–payshanba 10:00–16:00, juma 09:30–11:00 (yarim soat qadam), tasodifiy
        select array_agg(x order by random()) into slots from (
          select generate_series(td + case when extract(isodow from td) = 5 then '09:30'::time else '10:00'::time end,
                                 td + case when extract(isodow from td) = 5 then '11:00'::time else '16:00'::time end, interval '30 minutes')::time x) s;
        i := 1;
        while i + 1 <= array_length(ids, 1) loop
          t := slots[1 + ((i / 2) % array_length(slots, 1))];
          loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where liga_live.code = c); end loop;
          insert into public.liga_live(code, a_id, b_id, lang, qids, kind, win_from, win_to)
            values (c, ids[i], ids[i + 1], (select case when sp.lang = 'ru' then 'ru' else 'uz' end from public.safari_players sp where sp.id = ids[i]), public.liga_draw(public.liga_all_pools(), 'day|' || c, 10, 0, 0, 0), 'day',
                    (td + t) at time zone 'Asia/Tashkent', (td + t + interval '1 hour') at time zone 'Asia/Tashkent');
          insert into public.liga_day_duels(day, group_code, code, a_id, b_id, slot) values (td, g.code, c, ids[i], ids[i + 1], t);
          i := i + 2;
        end loop;
        isnew := true;
      end if;
    end if;
    return query
      select g.code, d.code, d.slot, s.id, s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name,
        trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.'),
        coalesce((select max(r.gain + r.bonus) from public.liga_runs r where r.kind = 'stage' and r.player_id = o.id and (r.started_at at time zone 'Asia/Tashkent')::date = pd), 0)::int,
        coalesce((select max(r.gain + r.bonus) from public.liga_runs r where r.kind = 'stage' and r.player_id = s.id and (r.started_at at time zone 'Asia/Tashkent')::date = pd), 0)::int,
        isnew
      from public.liga_day_duels d
      join public.safari_players s on s.id in (d.a_id, d.b_id)
      join public.safari_players o on o.id = case when s.id = d.a_id then d.b_id else d.a_id end
      where d.day = td and d.group_code = g.code;
  end loop;
end $$;

-- vaqti kelgan duellar (bot har 5 daqiqada so'raydi): ikkala o'yinchiga «Duel boshlandi»
create or replace function public.liga_day_duel_due_sys()
returns table(code text, slot time, tg bigint, lang text, first_name text, opp_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    update public.liga_day_duels d set notified_start = true
    where d.day = public.liga_today() and not d.notified_start
      and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '5 minutes'
      and (d.day + d.slot + interval '1 hour') at time zone 'Asia/Tashkent' > now()
    returning d.code, d.slot, d.a_id, d.b_id)
  select due.code, due.slot, s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name,
    trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.')
  from due join public.safari_players s on s.id in (due.a_id, due.b_id)
  join public.safari_players o on o.id = case when s.id = due.a_id then due.b_id else due.a_id end
  where s.tg_user_id is not null;
end $$;

-- ilova: mening bugungi juftim
create or replace function public.liga_day_duel_me(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_day_duels; l public.liga_live; me text; o uuid; on_ text;
begin
  select * into d from public.liga_day_duels where day = public.liga_today() and p_id in (a_id, b_id) limit 1;
  if d.code is null then return null; end if;
  perform public.liga_live_tick(d.code);
  select * into l from public.liga_live where code = d.code;
  me := case when l.a_id = p_id then 'a' else 'b' end; o := case when me = 'a' then l.b_id else l.a_id end;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into on_ from public.safari_players where id = o;
  return jsonb_strip_nulls(jsonb_build_object('code', l.code, 'slot', to_char(d.slot, 'HH24:MI'), 'opp', on_, 'status', l.status, 'note', l.note,
    'opens_in', case when now() < l.win_from then (extract(epoch from (l.win_from - now())) * 1000)::int end,
    'open', now() >= l.win_from and now() <= l.win_to, 'closed', now() > l.win_to,
    'my_pts', case when me = 'a' then l.a_pts else l.b_pts end, 'opp_pts', case when me = 'a' then l.b_pts else l.a_pts end,
    'won', case when l.status = 'done' then (case when me = 'a' then l.a_pts > l.b_pts or (l.a_pts = l.b_pts and l.a_ms < l.b_ms) else l.b_pts > l.a_pts or (l.a_pts = l.b_pts and l.b_ms < l.a_ms) end) end,
    'tie', case when l.status = 'done' then l.a_pts = l.b_pts and l.a_ms = l.b_ms end));
end $$;

-- admin: bugungi juftlar
create or replace function public.liga_day_duels_admin(p_pin text)
returns table(slot text, a_name text, b_name text, a_pts int, b_pts int, status text, note text)
language plpgsql stable security definer set search_path = public as $$
declare g text; r text := public.liga_pin_role(p_pin);
begin
  if r = 'admin' then select code into g from public.liga_groups where admin_pin = p_pin; elsif r = 'super' then g := 'ASOSIY'; else return; end if;
  return query select to_char(d.slot, 'HH24:MI'),
    (select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) from public.safari_players where id = d.a_id),
    (select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) from public.safari_players where id = d.b_id),
    l.a_pts, l.b_pts, l.status, l.note
  from public.liga_day_duels d join public.liga_live l on l.code = d.code
  where d.day = public.liga_today() and d.group_code = g order by d.slot;
end $$;

revoke all on function public.liga_day_pair_sys(), public.liga_day_duel_due_sys(), public.liga_live_view2(text, uuid) from public, anon, authenticated;
grant execute on function public.liga_day_pair_sys(), public.liga_day_duel_due_sys() to service_role;
grant execute on function public.liga_day_duel_me(uuid), public.liga_day_duels_admin(text) to anon, authenticated;

-- bot: vaqti kelgan duellar haqida xabar (dushanba–juma, 09:00–17:00 Toshkent = 04:00–12:00 UTC, har 5 daqiqada)
-- botni faqat vaqti kelgan duel bo'lsa chaqiradi
create or replace function public.liga_day_duel_tick() returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.liga_day_duels d where d.day = public.liga_today() and not d.notified_start
             and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '5 minutes') then
    perform public.liga_bot_call('duel_due');
  end if;
end $$;
revoke all on function public.liga_day_duel_tick() from public, anon, authenticated;
select cron.schedule('liga-juft-duel', '*/5 4-11 * * 1-5', $$select public.liga_day_duel_tick()$$);
