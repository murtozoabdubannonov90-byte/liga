-- 2026-10-28: 4 kishilik jonli duel («Guruh dueli», kodi Q + 6 belgi)
-- Bir kishi xona ochadi va havolani yuboradi, qolganlar shu havola orqali kiradi (2–4 o'yinchi).
-- 20 ta savol: avval 15 ta provodka, keyin 5 ta savol — faqat O'TGAN mavzulardan
-- (eski bosqichlar s0–s11 va bugundan oldingi kunlik bosqichlar dYYYYMMDD; bugungi va kelgusi kunlar savollari chiqmaydi).
-- Qoida jonli dueldagidek: kim birinchi to'g'ri javob bersa — +1 ochko va hammaga keyingi savol;
-- xato javob bergan shu savolda qulflanadi; hamma qulflansa yoki 90 soniya o'tsa — keyingi savol.
-- Teng ochkoda to'g'ri javoblarga kam vaqt sarflagan yuqori turadi. Liga baliga qo'shilmaydi.

create table if not exists public.liga_quad (
  code text primary key,
  host uuid not null,
  lang text not null default 'uz',
  qids text[] not null default '{}',
  status text not null default 'wait',          -- wait | play | done
  cur int not null default 0,
  q_at timestamptz,
  log jsonb not null default '[]',
  note text,                                     -- expired | cancel | idle
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create table if not exists public.liga_quad_p (
  code text not null references public.liga_quad(code) on delete cascade,
  pid uuid not null,
  seat int not null check (seat between 1 and 4),
  pts int not null default 0,
  ms int not null default 0,
  lock int not null default -1,
  seen timestamptz not null default now(),
  act timestamptz,
  joined_at timestamptz not null default now(),
  primary key (code, pid),
  unique (code, seat)
);
create index if not exists liga_quad_host_idx on public.liga_quad(host, created_at desc);
create index if not exists liga_quad_p_pid_idx on public.liga_quad_p(pid, joined_at desc);
alter table public.liga_quad enable row level security;
alter table public.liga_quad_p enable row level security;
revoke all on public.liga_quad, public.liga_quad_p from anon, authenticated;

create or replace function public.liga_quad_max() returns int language sql immutable as $$ select 4 $$;
create or replace function public.liga_quad_wait_min() returns int language sql immutable as $$ select 30 $$;

-- o'tgan mavzular: eski bosqichlar + bugundan oldingi kunlik bosqichlar
create or replace function public.liga_quad_pools() returns text[]
language sql stable security definer set search_path = public as $$
  select public.liga_all_pools() || coalesce((select array_agg(distinct pool) from public.liga_bank
    where active and pool ~ '^d[0-9]{8}$' and to_date(substr(pool, 2), 'YYYYMMDD') < public.liga_today()), '{}')
$$;

-- 15 provodka (avval) + 5 savol; o'yinchilar shu hafta ko'rmaganlari birinchi
create or replace function public.liga_quad_draw(p_seed text, p_players uuid[]) returns text[]
language sql stable security definer set search_path = public as $$
  with seen as (select qid from public.liga_seen_week(p_players)), pools as (select public.liga_quad_pools() p)
  select coalesce((select array_agg(id order by md5(id || p_seed || 't')) from (
            select id from public.liga_bank, pools where pool = any(pools.p) and active and t = 'pv'
            order by (id in (select qid from seen)), md5(id || p_seed) limit 15) a), '{}')
      || coalesce((select array_agg(id order by md5(id || p_seed || 't')) from (
            select id from public.liga_bank, pools where pool = any(pools.p) and active and t <> 'pv'
            order by (id in (select qid from seen)), (t <> 'mc'), md5(id || p_seed) limit 5) b), '{}')
$$;

create or replace function public.liga_quad_create(p_id uuid, p_token text, p_lang text default 'uz') returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if (select count(*) from public.liga_quad where host = p_id and created_at > now() - interval '2 minutes') >= 10 then raise exception 'too_many'; end if;
  -- shu odamning hali boshlanmagan eski xonalari yopiladi (bitta ochiq xona)
  update public.liga_quad set status = 'done', note = 'cancel', finished_at = now() where host = p_id and status = 'wait';
  loop c := 'Q' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_quad where code = c); end loop;
  insert into public.liga_quad(code, host, lang) values (c, p_id, case when p_lang = 'ru' then 'ru' else 'uz' end);
  insert into public.liga_quad_p(code, pid, seat) values (c, p_id, 1);
  return c;
end $$;

-- o'yinni boshlash (ichki): kelmay qolganlar chiqariladi, savollar o'ynayotganlarga qarab tanlanadi
create or replace function public.liga_quad_begin(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare ps uuid[];
begin
  delete from public.liga_quad_p where code = p_code and seen < now() - interval '10 seconds'
    and pid <> (select host from public.liga_quad where code = p_code);
  select array_agg(pid) into ps from public.liga_quad_p where code = p_code;
  if coalesce(array_length(ps, 1), 0) < 2 then return false; end if;
  update public.liga_quad set status = 'play', started_at = now(), cur = 0, q_at = now() + interval '4 seconds',
    qids = public.liga_quad_draw('quad|' || p_code, ps) where code = p_code;
  update public.liga_quad_p set act = null, lock = -1 where code = p_code;
  return true;
end $$;

create or replace function public.liga_quad_next(p_code text, p_w int) returns void
language plpgsql security definer set search_path = public as $$
declare d public.liga_quad;
begin
  select * into d from public.liga_quad where code = p_code;
  update public.liga_quad set log = log || jsonb_build_object('k', d.cur, 'w', p_w),
    cur = d.cur + 1, q_at = now() + interval '2500 milliseconds',
    status = case when d.cur + 1 >= array_length(d.qids, 1) then 'done' else 'play' end,
    finished_at = case when d.cur + 1 >= array_length(d.qids, 1) then now() end
  where code = p_code;
  update public.liga_quad_p set lock = -1 where code = p_code;
end $$;

create or replace function public.liga_quad_tick(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.liga_quad; i int := 0; n int; here int; base timestamptz; live_n int; locked_n int;
begin
  select * into d from public.liga_quad where code = p_code for update;
  if d.code is null or d.status = 'done' then return; end if;
  if d.status = 'wait' then
    if d.created_at < now() - make_interval(mins => public.liga_quad_wait_min()) then
      update public.liga_quad set status = 'done', note = 'expired', finished_at = now() where code = p_code; return;
    end if;
    select count(*), count(*) filter (where seen > now() - interval '5 seconds') into n, here from public.liga_quad_p where code = p_code;
    if n >= public.liga_quad_max() and here = n then perform public.liga_quad_begin(p_code); end if;   -- 4 kishi to'ldi — o'zi boshlanadi
    return;
  end if;
  -- hech kim 7 daqiqa javob bermasa — duel yakunlanadi
  base := d.started_at + interval '4 seconds';
  if not exists (select 1 from public.liga_quad_p where code = p_code
                 and now() - greatest(base, coalesce(act, base)) <= make_interval(secs => public.liga_live_idle_sec())) then
    update public.liga_quad set status = 'done', note = 'idle', finished_at = now() where code = p_code; return;
  end if;
  -- vaqt tugagan savollar
  while d.status = 'play' and now() > d.q_at + make_interval(secs => public.liga_live_qsec()) and i < 25 loop
    perform public.liga_quad_next(p_code, null);
    select * into d from public.liga_quad where code = p_code; i := i + 1;
  end loop;
  -- ilovada qolganlarning hammasi xato qilgan bo'lsa — keyingi savol (chiqib ketgan o'yinchini kutmaymiz)
  if d.status = 'play' and now() >= d.q_at then
    select count(*) filter (where seen > now() - interval '15 seconds' or lock = d.cur),
           count(*) filter (where lock = d.cur) into live_n, locked_n
    from public.liga_quad_p where code = p_code;
    if locked_n > 0 and locked_n >= live_n then perform public.liga_quad_next(p_code, null); end if;
  end if;
end $$;

create or replace function public.liga_quad_view(p_code text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d public.liga_quad; me public.liga_quad_p; b public.liga_bank; pb public.liga_bank; L text; last jsonb; pl jsonb; rk jsonb; wseat int; tie boolean;
begin
  select * into d from public.liga_quad where code = p_code;
  if d.code is null then raise exception 'not_found'; end if;
  select * into me from public.liga_quad_p where code = p_code and pid = p_id;
  select case when lang = 'ru' then 'ru' else 'uz' end into L from public.safari_players where id = p_id;
  L := coalesce(L, d.lang, 'uz');
  select jsonb_agg(jsonb_build_object('s', p.seat, 'name', public.liga_pname(p.pid), 'pts', p.pts, 'ms', p.ms,
           'here', p.seen > now() - interval '15 seconds', 'host', p.pid = d.host, 'me', p.pid = p_id,
           'locked', d.status = 'play' and p.lock = d.cur) order by p.seat)
    into pl from public.liga_quad_p p where p.code = p_code;
  if d.status = 'play' and now() >= d.q_at then select * into b from public.liga_bank where id = d.qids[d.cur + 1]; end if;
  if d.cur > 0 and d.status <> 'wait' then
    select * into pb from public.liga_bank where id = d.qids[d.cur];
    wseat := nullif(d.log -> (d.cur - 1) ->> 'w', '')::int;
    last := jsonb_build_object('k', d.cur - 1, 'w', wseat, 'w_name', (select public.liga_pname(pid) from public.liga_quad_p where code = p_code and seat = wseat),
      'q', (case when L = 'ru' then pb.ru else pb.uz end) ->> 'q', 't', pb.t,
      'o', case when pb.t = 'mc' then (case when L = 'ru' then pb.ru else pb.uz end) -> 'o' end) || public.liga_q_reveal(pb, L);
  end if;
  if d.status = 'done' and d.started_at is not null then
    select jsonb_agg(seat order by pts desc, ms, seat) into rk from public.liga_quad_p where code = p_code;
    select case when count(*) = 1 then min(seat) end, count(*) > 1 into wseat, tie from public.liga_quad_p q
      where code = p_code and (pts, ms) = (select pts, ms from public.liga_quad_p where code = p_code order by pts desc, ms limit 1);
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'code', d.code, 'status', d.status, 'note', d.note, 'me', me.seat, 'is_host', p_id = d.host, 'max', public.liga_quad_max(),
    'players', coalesce(pl, '[]'), 'n', coalesce(array_length(d.qids, 1), 20), 'cur', d.cur, 'qsec', public.liga_live_qsec(),
    'closes_in', case when d.status = 'wait' then greatest(0, extract(epoch from (d.created_at + make_interval(mins => public.liga_quad_wait_min()) - now())) * 1000)::int end,
    'q_in', case when d.status = 'play' then greatest(0, extract(epoch from (d.q_at - now())) * 1000)::int end,
    'left', case when d.status = 'play' and now() >= d.q_at then greatest(0, extract(epoch from (d.q_at + make_interval(secs => public.liga_live_qsec()) - now())) * 1000)::int end,
    'item', case when b.id is not null then public.liga_q_pub(b, L) || jsonb_build_object('k', d.cur) end,
    'locked', case when me.seat is not null and d.status = 'play' then me.lock = d.cur end,
    'last', last, 'rank', rk, 'winner', case when d.status = 'done' then wseat end, 'tie', tie));
end $$;

-- holat (har soniyada). Xonaga havola orqali kirgan odam bo'sh joy bo'lsa o'yinchi bo'ladi, aks holda tomoshabin
create or replace function public.liga_quad_state(p_id uuid, p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.liga_quad; c text := upper(trim(p_code)); n int; s int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_quad where code = c for update;
  if d.code is null then raise exception 'not_found'; end if;
  if exists (select 1 from public.liga_quad_p where code = c and pid = p_id) then
    update public.liga_quad_p set seen = now() where code = c and pid = p_id;
  elsif d.status = 'wait' and d.created_at > now() - make_interval(mins => public.liga_quad_wait_min()) then
    select count(*) into n from public.liga_quad_p where code = c;
    if n < public.liga_quad_max() then
      if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
      select min(x) into s from generate_series(1, public.liga_quad_max()) x where x not in (select seat from public.liga_quad_p where code = c);
      insert into public.liga_quad_p(code, pid, seat) values (c, p_id, s);
    end if;
  end if;
  perform public.liga_quad_tick(c);
  return public.liga_quad_view(c, p_id);
end $$;

-- xona egasi «Boshlash»ni bosadi (kamida 2 kishi ilovada bo'lsa)
create or replace function public.liga_quad_start(p_id uuid, p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.liga_quad; c text := upper(trim(p_code)); here int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_quad where code = c for update;
  if d.code is null then raise exception 'not_found'; end if;
  if d.host <> p_id then raise exception 'not_host'; end if;
  if d.status <> 'wait' then return public.liga_quad_view(c, p_id); end if;
  update public.liga_quad_p set seen = now() where code = c and pid = p_id;
  select count(*) into here from public.liga_quad_p where code = c and seen > now() - interval '10 seconds';
  if here < 2 or not public.liga_quad_begin(c) then raise exception 'quad_few'; end if;
  return public.liga_quad_view(c, p_id);
end $$;

-- o'yin boshlanmasdan xonadan chiqish (egasi chiqsa — xona yopiladi)
create or replace function public.liga_quad_leave(p_id uuid, p_token text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.liga_quad; c text := upper(trim(p_code));
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_quad where code = c for update;
  if d.code is null or d.status <> 'wait' then return; end if;
  if d.host = p_id then update public.liga_quad set status = 'done', note = 'cancel', finished_at = now() where code = c;
  else delete from public.liga_quad_p where code = c and pid = p_id; end if;
end $$;

create or replace function public.liga_quad_answer(p_id uuid, p_token text, p_code text, p_k int, p_ans jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.liga_quad; c text := upper(trim(p_code)); me public.liga_quad_p; b public.liga_bank; ok boolean; why text := ''; v_ms int; live_n int; locked_n int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  perform public.liga_quad_tick(c);
  select * into d from public.liga_quad where code = c for update;
  if d.code is null then raise exception 'not_found'; end if;
  select * into me from public.liga_quad_p where code = c and pid = p_id for update;
  if me.pid is null then raise exception 'duel_taken'; end if;
  update public.liga_quad_p set seen = now(), act = case when d.status = 'play' then now() else act end where code = c and pid = p_id;
  if d.status <> 'play' or p_k is distinct from d.cur or now() < d.q_at then
    why := 'late';
  elsif me.lock = d.cur then
    why := 'locked';
  elsif coalesce(p_ans ->> 'left', '') = 'true' then
    why := 'left';
    update public.liga_quad_p set lock = d.cur where code = c and pid = p_id;
  else
    select * into b from public.liga_bank where id = d.qids[d.cur + 1];
    ok := public.liga_q_ok(b, coalesce(p_ans, '{}'::jsonb));
    if ok then
      v_ms := (extract(epoch from (now() - d.q_at)) * 1000)::int;
      update public.liga_quad_p set pts = pts + 1, ms = ms + v_ms where code = c and pid = p_id;
      perform public.liga_quad_next(c, me.seat);
    else
      why := 'wrong';
      update public.liga_quad_p set lock = d.cur where code = c and pid = p_id;
    end if;
  end if;
  if why in ('wrong', 'left') then
    select count(*) filter (where seen > now() - interval '15 seconds' or lock = d.cur), count(*) filter (where lock = d.cur)
      into live_n, locked_n from public.liga_quad_p where code = c;
    if locked_n >= live_n then perform public.liga_quad_next(c, null); end if;
  end if;
  return public.liga_quad_view(c, p_id) || jsonb_build_object('ok', coalesce(ok, false), 'why', why);
end $$;

create or replace function public.liga_quad_away(p_id uuid, p_token text, p_code text, p_k int, p_ms int) returns void
language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(p_code));
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not exists (select 1 from public.liga_quad_p where code = c and pid = p_id) then return; end if;
  if (select count(*) from public.liga_away where ref = c) >= 400 then return; end if;
  insert into public.liga_away(player_id, kind, ref, k, ms) values (p_id, 'quad', c, p_k, least(greatest(coalesce(p_ms, 0), 0), 3600000));
end $$;

-- mening oxirgi 4 kishilik duellarim
create or replace function public.liga_quad_list(p_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select q.code, q.status, q.note, q.created_at at, (select count(*) from public.liga_quad_p where code = q.code) n,
      (select string_agg(public.liga_pname(pid), ', ' order by seat) from public.liga_quad_p where code = q.code and pid <> p_id) others,
      (select pos from (select pid, row_number() over (order by pts desc, ms, seat) pos from public.liga_quad_p where code = q.code) r where r.pid = p_id) place,
      mp.pts
    from public.liga_quad_p mp join public.liga_quad q on q.code = mp.code
    where mp.pid = p_id and q.created_at > now() - interval '14 days' and not (q.status = 'done' and q.started_at is null)
    order by q.created_at desc limit 10) x), '[]');
end $$;

revoke all on function public.liga_quad_begin(text), public.liga_quad_next(text, int), public.liga_quad_tick(text),
  public.liga_quad_view(text, uuid), public.liga_quad_draw(text, uuid[]), public.liga_quad_pools() from public, anon, authenticated;
grant execute on function public.liga_quad_create(uuid, text, text), public.liga_quad_state(uuid, text, text), public.liga_quad_start(uuid, text, text),
  public.liga_quad_leave(uuid, text, text), public.liga_quad_answer(uuid, text, text, int, jsonb), public.liga_quad_away(uuid, text, text, int, int),
  public.liga_quad_list(uuid, text) to anon, authenticated;
