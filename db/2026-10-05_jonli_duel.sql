-- 2026-10-05
--  • Jonli duel: ikki o'yinchi bir vaqtda o'ynaydi. Kim birinchi to'g'ri javob bersa — ochko oladi va ikkalasiga keyingi savol chiqadi.
--    Xato javob bergan shu savolda qulflanadi; ikkalasi xato qilsa yoki 1 daqiqa o'tsa — savol hech kimga bermay o'tadi.
--    Hamma narsa serverda: savollar javobsiz beriladi, javob serverda tekshiriladi, vaqtni server hisoblaydi.
--  • Admin uchun jamoa natijalari (faqat bosqich ballari; kunlik mashq va blits kirmaydi) — liga_admin_live

create table if not exists public.liga_live(
  code text primary key,
  a_id uuid not null references public.safari_players(id) on delete cascade,
  b_id uuid references public.safari_players(id) on delete cascade,
  lang text not null default 'uz', qids text[] not null,
  status text not null default 'wait' check (status in ('wait','play','done')),
  cur int not null default 0, q_at timestamptz,
  a_pts int not null default 0, b_pts int not null default 0, a_ms int not null default 0, b_ms int not null default 0,
  a_lock int not null default -1, b_lock int not null default -1,
  a_seen timestamptz, b_seen timestamptz,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz);
alter table public.liga_live enable row level security;
create index if not exists liga_live_a on public.liga_live(a_id, created_at desc);
create index if not exists liga_live_b on public.liga_live(b_id, created_at desc);

create or replace function public.liga_live_qsec() returns int language sql immutable as $$ select 60 $$;

-- keyingi savolga o'tish (qisqa tanaffus — oldingi savol javobi ko'rsatiladi)
create or replace function public.liga_live_next(p_code text, p_w text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.liga_live;
begin
  select * into d from public.liga_live where code = p_code;
  update public.liga_live set log = log || jsonb_build_object('k', d.cur, 'w', p_w),
    cur = d.cur + 1, q_at = now() + interval '2500 milliseconds', a_lock = -1, b_lock = -1,
    status = case when d.cur + 1 >= array_length(d.qids, 1) then 'done' else 'play' end,
    finished_at = case when d.cur + 1 >= array_length(d.qids, 1) then now() end
  where code = p_code;
end $$;

-- vaqt bo'yicha holatni yangilash: boshlash (ikkalasi ham ekranda) va vaqti o'tgan savollar
create or replace function public.liga_live_tick(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.liga_live; i int := 0;
begin
  select * into d from public.liga_live where code = p_code for update;
  if d.code is null then return; end if;
  if d.status = 'wait' and d.b_id is not null and d.a_seen > now() - interval '5 seconds' and d.b_seen > now() - interval '5 seconds' then
    update public.liga_live set status = 'play', started_at = now(), cur = 0, q_at = now() + interval '4 seconds' where code = p_code;
    return;
  end if;
  while d.status = 'play' and now() > d.q_at + make_interval(secs => public.liga_live_qsec()) and i < 12 loop
    perform public.liga_live_next(p_code, null);
    select * into d from public.liga_live where code = p_code; i := i + 1;
  end loop;
end $$;

create or replace function public.liga_live_view(p_code text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.liga_live; side text; b public.liga_bank; pb public.liga_bank; last jsonb; an text; bn text; win text;
begin
  select * into d from public.liga_live where code = p_code;
  if d.code is null then raise exception 'not_found'; end if;
  side := case when p_id = d.a_id then 'a' when p_id = d.b_id then 'b' end;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into an from public.safari_players where id = d.a_id;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into bn from public.safari_players where id = d.b_id;
  if d.status = 'play' and now() >= d.q_at then select * into b from public.liga_bank where id = d.qids[d.cur + 1]; end if;
  if d.cur > 0 then
    select * into pb from public.liga_bank where id = d.qids[d.cur];
    last := jsonb_build_object('k', d.cur - 1, 'w', d.log -> (d.cur - 1) -> 'w', 'q', (case when d.lang = 'ru' then pb.ru else pb.uz end) ->> 'q',
      't', pb.t, 'o', case when pb.t = 'mc' then (case when d.lang = 'ru' then pb.ru else pb.uz end) -> 'o' end) || public.liga_q_reveal(pb, d.lang);
  end if;
  if d.status = 'done' then
    win := case when d.a_pts > d.b_pts then 'a' when d.b_pts > d.a_pts then 'b' when d.a_ms < d.b_ms then 'a' when d.b_ms < d.a_ms then 'b' else 'tie' end;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'code', d.code, 'status', d.status, 'me', side, 'a_name', an, 'b_name', bn, 'a_pts', d.a_pts, 'b_pts', d.b_pts,
    'a_ms', d.a_ms, 'b_ms', d.b_ms, 'n', array_length(d.qids, 1), 'cur', d.cur, 'qsec', public.liga_live_qsec(),
    'q_in', case when d.status = 'play' then greatest(0, extract(epoch from (d.q_at - now())) * 1000)::int end,
    'left', case when d.status = 'play' and now() >= d.q_at then greatest(0, extract(epoch from (d.q_at + make_interval(secs => public.liga_live_qsec()) - now())) * 1000)::int end,
    'item', case when b.id is not null then public.liga_q_pub(b, d.lang) || jsonb_build_object('k', d.cur) end,
    'locked', case side when 'a' then d.a_lock = d.cur when 'b' then d.b_lock = d.cur end,
    'opp_locked', case side when 'a' then d.b_lock = d.cur when 'b' then d.a_lock = d.cur end,
    'opp_here', case side when 'a' then d.b_seen > now() - interval '5 seconds' when 'b' then d.a_seen > now() - interval '5 seconds' end,
    'last', last, 'log', d.log, 'winner', win));
end $$;

create or replace function public.liga_live_create(p_id uuid, p_token text, p_lang text default 'uz') returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if (select count(*) from public.liga_live where a_id = p_id and created_at > now() - interval '1 day') >= 30 then raise exception 'too_many'; end if;
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where code = c); end loop;
  insert into public.liga_live(code, a_id, lang, qids, a_seen)
    values (c, p_id, case when p_lang = 'ru' then 'ru' else 'uz' end, public.liga_draw(public.liga_all_pools(), 'live|' || c, 4, 3, 3, 0), now());
  return c;
end $$;

-- holat (ikkala o'yinchi har soniyada so'raydi); B birinchi marta ochsa — raqib sifatida qo'shiladi
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
  return public.liga_live_view(c, p_id);
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
  return public.liga_live_view(c, p_id) || jsonb_build_object('ok', coalesce(ok, false), 'why', why);
end $$;

create or replace function public.liga_live_list(p_id uuid, p_token text)
returns table(code text, a_name text, b_name text, a_pts int, b_pts int, status text, is_a boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.code,
    (select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') from public.safari_players where id = l.a_id),
    (select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') from public.safari_players where id = l.b_id),
    l.a_pts, l.b_pts, l.status, l.a_id = p_id, l.created_at
  from public.liga_live l
  where public.liga_auth(p_id, p_token) and (l.a_id = p_id or l.b_id = p_id)
  order by l.created_at desc limit 20
$$;

-- ---------- admin: jamoa natijalari (faqat bosqich ballari) ----------
create or replace function public.liga_admin_live(p_pin text)
returns table(name text, today_si int, today_pts int, today_right int, today_done int, today_n int, today_finished boolean, week_pts int, week_stages int, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare g text; r text := public.liga_pin_role(p_pin); wid text := public.liga_cur_week_id(); td date := public.liga_today();
begin
  if r = 'admin' then select code into g from public.liga_groups where admin_pin = p_pin;
  elsif r = 'super' then g := 'ASOSIY';
  else return; end if;
  return query
  select trim(coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')),
    t.ref::int, coalesce(t.gain + t.bonus, 0), coalesce(t.right_n, 0), coalesce(t.done_n, 0), coalesce(array_length(t.qids, 1), 0), t.finished_at is not null,
    coalesce(w.pts, 0)::int, coalesce(w.cnt, 0)::int, greatest(t.started_at, s.last_active)
  from public.safari_players s
  left join lateral (select * from public.liga_runs x where x.kind = 'stage' and x.player_id = s.id and (x.started_at at time zone 'Asia/Tashkent')::date = td
                     order by x.started_at desc limit 1) t on true
  left join lateral (select sum(x.gain + x.bonus) pts, count(*) filter (where x.finished_at is not null) cnt from public.liga_runs x
                     where x.kind = 'stage' and x.player_id = s.id and x.week_id = wid) w on true
  where s.group_code = g
  order by coalesce(w.pts, 0) desc, coalesce(t.gain + t.bonus, 0) desc, s.first_name;
end $$;

revoke all on function public.liga_live_next(text, text), public.liga_live_tick(text), public.liga_live_view(text, uuid) from public, anon, authenticated;
grant execute on function public.liga_live_create(uuid, text, text), public.liga_live_state(uuid, text, text),
  public.liga_live_answer(uuid, text, text, int, jsonb), public.liga_live_list(uuid, text), public.liga_admin_live(text), public.liga_live_qsec() to anon, authenticated;
