-- Hisobchi Liga — 2026-10-03b: javoblar faqat serverda tekshiriladi
--  • liga_bank — liga savollari (javoblari bilan) faqat serverda; ilovaga javobsiz yuboriladi
--  • liga_runs / liga_run_ans — bosqich, oylik final, duel, xodim testi: har savol serverda tekshiriladi,
--    vaqt (60 s) serverda o'lchanadi, ball serverda hisoblanadi
--  • bosqich: har o'yinchiga 40 tadan 20 ta savol (12 provodka + 8 boshqa) — har kimga boshqacha
--  • liga_save endi bosqich ballarini qabul qilmaydi (faqat server yozadi)
--  • Telegram orqali kirish: bir nechta qurilma (liga_tokens), bot orqali kirish kodi
--  • cheklarga kunlik cheklov olib tashlandi
--  • soliq taqvimi, qonun yangiliklari, jamoalar bellashuvi
-- Hammasi yangi jadval / "create or replace" — hech narsa o'chirilmaydi.

-- =============== savollar banki ===============
create table if not exists public.liga_bank(
  id text primary key, pool text not null, t text not null check (t in ('pv','mc','calc')),
  uz jsonb not null, ru jsonb not null, dt text, kt text, a numeric,
  active boolean not null default true, created_at timestamptz not null default now());
alter table public.liga_bank enable row level security;
create index if not exists liga_bank_pool on public.liga_bank(pool, t) where active;

create table if not exists public.liga_runs(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('stage','final','duel','test')),
  player_id uuid references public.safari_players(id) on delete cascade,
  ref text not null, week_id text, lang text not null default 'uz', qids text[] not null, secret_hash text,
  started_at timestamptz not null default now(), finished_at timestamptz,
  combo int not null default 0, right_n int not null default 0, done_n int not null default 0,
  gain int not null default 0, bonus int not null default 0, stars int, ms int);
alter table public.liga_runs enable row level security;
create unique index if not exists liga_runs_stage on public.liga_runs(player_id, ref, week_id) where kind = 'stage';
create unique index if not exists liga_runs_once on public.liga_runs(kind, player_id, ref) where kind in ('final','duel');
create unique index if not exists liga_runs_test on public.liga_runs(ref) where kind = 'test';

create table if not exists public.liga_run_ans(
  run_id uuid not null references public.liga_runs(id) on delete cascade, k int not null, qid text not null,
  shown_at timestamptz, answered_at timestamptz, ok boolean, why text, gain int not null default 0, ans jsonb,
  primary key (run_id, k));
alter table public.liga_run_ans enable row level security;

-- =============== yordamchilar ===============
create or replace function public.liga_close_hour(d date) returns int language sql immutable as $$
  select case when extract(isodow from d) = 5 then 12 else 17 end $$;

-- bugun shu jamoada shu bosqich ochiqmi (grace — yopilgandan keyin necha daqiqa javob qabul qilinadi)
create or replace function public.liga_stage_window(p_group text, p_si int, p_grace int default 0)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.liga_groups g where g.code = p_group and public.liga_stage_index(g.start_date, public.liga_today()) = p_si)
    and (now() at time zone 'Asia/Tashkent')::time >= time '09:00'
    and (now() at time zone 'Asia/Tashkent')::time < make_time(public.liga_close_hour(public.liga_today()), 0, 0) + make_interval(mins => p_grace)
$$;

create or replace function public.liga_q_pub(b public.liga_bank, p_lang text) returns jsonb language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('t', b.t, 'q', c->>'q', 'o', case when b.t in ('pv','mc') then c->'o' end, 'unit', c->>'unit'))
  from (select case when p_lang = 'ru' then b.ru else b.uz end as c) x
$$;
create or replace function public.liga_q_reveal(b public.liga_bank, p_lang text) returns jsonb language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('dt', b.dt, 'kt', b.kt, 'a', b.a, 'e', (case when p_lang = 'ru' then b.ru else b.uz end)->>'e'))
$$;
create or replace function public.liga_q_ok(b public.liga_bank, p jsonb) returns boolean language sql stable as $$
  select coalesce(case b.t
    when 'pv' then p->>'dt' = b.dt and p->>'kt' = b.kt
    when 'mc' then (p->>'pick') ~ '^\d+$' and (p->>'pick')::numeric = b.a
    else regexp_replace(coalesce(p->>'val',''), '[^0-9-]', '', 'g') ~ '^-?\d+$' and regexp_replace(p->>'val', '[^0-9-]', '', 'g')::numeric = b.a end, false)
$$;

-- savollar tanlash: urug' bo'yicha barqaror (bir xil urug' — bir xil savollar)
create or replace function public.liga_draw(p_pools text[], p_seed text, p_pv int, p_calc int, p_mc int, p_other int)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by md5(id || p_seed || 'tartib')), '{}') from (
    (select id from public.liga_bank where pool = any(p_pools) and active and t = 'pv' order by md5(id || p_seed) limit p_pv)
    union all (select id from public.liga_bank where pool = any(p_pools) and active and t = 'calc' order by md5(id || p_seed) limit p_calc)
    union all (select id from public.liga_bank where pool = any(p_pools) and active and t = 'mc' order by md5(id || p_seed) limit p_mc)
    union all (select id from public.liga_bank where pool = any(p_pools) and active and t <> 'pv' order by md5(id || p_seed || 'x') limit p_other)) x
$$;
create or replace function public.liga_all_pools() returns text[] language sql immutable as $$
  select array['s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11'] $$;

create or replace function public.liga_run_new(p_kind text, p_player uuid, p_ref text, p_week text, p_lang text, p_qids text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  insert into public.liga_runs(kind, player_id, ref, week_id, lang, qids)
    values (p_kind, p_player, p_ref, p_week, case when p_lang = 'ru' then 'ru' else 'uz' end, p_qids) returning id into rid;
  insert into public.liga_run_ans(run_id, k, qid) select rid, (o - 1)::int, q from unnest(p_qids) with ordinality u(q, o);
  return rid;
end $$;

create or replace function public.liga_run_state(p_run uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('run', r.id, 'kind', r.kind, 'ref', r.ref, 'n', array_length(r.qids, 1), 'combo', r.combo, 'right_n', r.right_n,
    'done_n', r.done_n, 'gain', r.gain, 'bonus', r.bonus, 'stars', r.stars, 'finished', r.finished_at is not null, 'started_at', r.started_at, 'ms', r.ms)
  from public.liga_runs r where r.id = p_run
$$;
create or replace function public.liga_run_view(p_run uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select public.liga_run_state(r.id) || jsonb_build_object('items', (
    select jsonb_agg(public.liga_q_pub(b, r.lang) || jsonb_build_object('k', a.k,
      'st', case when a.answered_at is null then null when a.ok then 'ok' else 'bad' end) order by a.k)
    from public.liga_run_ans a join public.liga_bank b on b.id = a.qid where a.run_id = r.id))
  from public.liga_runs r where r.id = p_run
$$;

create or replace function public.liga_run_auth(p_run uuid, p_id uuid, p_token text, p_secret text)
returns public.liga_runs language plpgsql stable security definer set search_path = public as $$
declare r public.liga_runs;
begin
  select * into r from public.liga_runs where id = p_run;
  if r.id is null then raise exception 'not_found'; end if;
  if r.kind = 'test' then
    if p_secret is null or r.secret_hash is distinct from public.liga_hash(p_secret) then raise exception 'bad_token'; end if;
  elsif r.player_id is distinct from p_id or not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return r;
end $$;

-- bosqich bali o'yinchining haftalik jadvaliga (faqat server yozadi)
create or replace function public.liga_stage_score(p_player uuid, p_si int, p_week text, p_val int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_week is distinct from public.liga_cur_week_id() then return; end if;
  update public.safari_players set
    week_stages = (case when week_id = p_week then coalesce(week_stages, '{}'::jsonb) else '{}'::jsonb end) || jsonb_build_object(p_si::text, least(greatest(p_val, 0), 450)),
    week_id = p_week,
    stages = greatest(coalesce(stages, 0), (select count(distinct ref) from public.liga_runs where player_id = p_player and kind = 'stage' and finished_at is not null)::int),
    last_active = now()
  where id = p_player;
end $$;

-- final / duel / test yakuni — natija tegishli jadvalga
create or replace function public.liga_run_close(p_run uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.liga_runs; mins int;
begin
  update public.liga_runs set finished_at = now(), ms = (extract(epoch from now() - started_at) * 1000)::int
    where id = p_run and finished_at is null returning * into r;
  if r.id is null then return; end if;
  if r.kind = 'final' then
    insert into public.liga_finals(month, player_id, group_code, score, ms) values (r.ref, r.player_id, public.liga_my_group(r.player_id), r.right_n * 20, r.ms)
      on conflict (month, player_id) do nothing;
  elsif r.kind = 'duel' then
    update public.liga_duels set a_score = r.right_n, a_ms = r.ms where code = r.ref and a_id = r.player_id and a_score is null;
    update public.liga_duels set b_id = r.player_id, b_score = r.right_n, b_ms = r.ms
      where code = r.ref and a_id <> r.player_id and b_score is null and (b_id is null or b_id = r.player_id);
  elsif r.kind = 'test' then
    select t.minutes into mins from public.liga_test_runs tr join public.liga_tests t on t.code = tr.code where tr.id = r.ref::uuid;
    update public.liga_test_runs tr set finished_at = now(), score = r.right_n, total = array_length(r.qids, 1), ms = r.ms,
      late = now() > tr.started_at + make_interval(mins => coalesce(mins, 30) + 2),
      detail = (select jsonb_agg(jsonb_build_object('pool', b.pool, 't', b.t, 'ok', coalesce(a.ok, false)) order by a.k)
                from public.liga_run_ans a join public.liga_bank b on b.id = a.qid where a.run_id = r.id)
    where tr.id = r.ref::uuid and tr.finished_at is null;
  end if;
end $$;

-- hamma savol javob berilgan bo'lsa — yakun (bosqich: yulduz va bonus)
create or replace function public.liga_run_settle(p_run uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.liga_runs; n int; miss int; st int;
begin
  select * into r from public.liga_runs where id = p_run;
  n := array_length(r.qids, 1);
  if r.kind = 'stage' then
    if r.finished_at is null and r.done_n >= n then
      miss := n - r.right_n; st := case when miss = 0 then 3 when miss <= 2 then 2 else 1 end;
      update public.liga_runs set finished_at = now(), stars = st, bonus = st * 30, ms = (extract(epoch from now() - started_at) * 1000)::int
        where id = p_run returning * into r;
    end if;
    perform public.liga_stage_score(r.player_id, r.ref::int, r.week_id, r.gain + r.bonus);
  elsif r.finished_at is null and r.done_n >= n then
    perform public.liga_run_close(p_run);
  end if;
end $$;

-- ko'rsatilib, 65 soniyada javob berilmagan savollar — xato (vaqt tugadi / ilovadan chiqib ketdi)
create or replace function public.liga_run_sweep(p_run uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.liga_run_ans set ok = false, why = 'time', answered_at = now()
    where run_id = p_run and answered_at is null and shown_at is not null and shown_at < now() - interval '65 seconds';
  get diagnostics n = row_count;
  if n > 0 then
    update public.liga_runs set done_n = done_n + n, combo = 0 where id = p_run;
    perform public.liga_run_settle(p_run);
  end if;
end $$;

-- majburiy yakun (final/duel/test: qolgan savollar xato)
create or replace function public.liga_run_finish_sys(p_run uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.liga_run_ans set ok = false, why = 'skip', answered_at = now() where run_id = p_run and answered_at is null;
  get diagnostics n = row_count;
  update public.liga_runs set done_n = done_n + n where id = p_run;
  perform public.liga_run_close(p_run);
end $$;

-- =============== o'yinchi uchun: boshlash, savolni ko'rsatish, javob, yakun ===============
create or replace function public.liga_stage_start(p_id uuid, p_token text, p_si int, p_lang text default 'uz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare g text; wid text := public.liga_cur_week_id(); rid uuid; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  g := public.liga_my_group(p_id);
  if p_si is null or p_si < 0 or p_si > 11 or not public.liga_stage_window(g, p_si, 0) then raise exception 'stage_closed'; end if;
  select id into rid from public.liga_runs where kind = 'stage' and player_id = p_id and ref = p_si::text and week_id = wid;
  if rid is null then
    q := public.liga_draw(array['s' || p_si], p_id::text || '|' || wid || '|' || p_si, 12, 0, 0, 8);
    if coalesce(array_length(q, 1), 0) = 0 then raise exception 'not_found'; end if;
    begin rid := public.liga_run_new('stage', p_id, p_si::text, wid, p_lang, q);
    exception when unique_violation then
      select id into rid from public.liga_runs where kind = 'stage' and player_id = p_id and ref = p_si::text and week_id = wid;
    end;
  else
    update public.liga_runs set lang = case when p_lang = 'ru' then 'ru' else 'uz' end where id = rid;
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;

create or replace function public.liga_final_start(p_id uuid, p_token text, p_lang text default 'uz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare mm text := public.liga_month_now(); g text; nowt timestamp := now() at time zone 'Asia/Tashkent'; rid uuid; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  g := public.liga_my_group(p_id);
  if nowt::date <> public.liga_final_date(mm) or nowt::time not between time '10:00' and time '13:00' then raise exception 'final_closed'; end if;
  if not exists (select 1 from public.liga_final_qualifiers(g, mm) x where x.player_id = p_id) then raise exception 'not_qualified'; end if;
  select id into rid from public.liga_runs where kind = 'final' and player_id = p_id and ref = mm;
  if rid is null then
    if exists (select 1 from public.liga_finals f where f.month = mm and f.player_id = p_id) then raise exception 'already_done'; end if;
    q := public.liga_draw(public.liga_all_pools(), 'final|' || mm || '|' || g, 8, 6, 6, 0);
    rid := public.liga_run_new('final', p_id, mm, null, p_lang, q);
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;

create or replace function public.liga_duel_start(p_id uuid, p_token text, p_code text, p_lang text default 'uz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_duels; rid uuid; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_duels where code = upper(trim(p_code)) for update;
  if d.code is null then raise exception 'not_found'; end if;
  if d.a_id = p_id then
    if d.a_score is not null then raise exception 'already_done'; end if;
  else
    if d.b_id is not null and d.b_id <> p_id then raise exception 'duel_taken'; end if;
    if d.b_score is not null then raise exception 'already_done'; end if;
    if d.created_at < now() - interval '7 days' then raise exception 'duel_expired'; end if;
    update public.liga_duels set b_id = p_id where code = d.code and b_id is null;
  end if;
  select id into rid from public.liga_runs where kind = 'duel' and player_id = p_id and ref = d.code;
  if rid is null then
    q := public.liga_draw(public.liga_all_pools(), 'duel|' || d.code, 4, 3, 3, 0);
    rid := public.liga_run_new('duel', p_id, d.code, null, p_lang, q);
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;

-- xodim testi (nomzod ro'yxatdan o'tmaydi): har nomzodga o'z savollari, maxfiy kalit bilan
create or replace function public.liga_test_begin(p_code text, p_name text, p_phone text, p_lang text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.liga_tests; tr public.liga_test_runs; rid uuid; q text[]; sec text := encode(extensions.gen_random_bytes(16), 'hex'); npv int; ncalc int;
begin
  select * into t from public.liga_tests where code = upper(trim(p_code));
  if t.code is null or not t.active then raise exception 'test_closed'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 or coalesce(p_phone, '') !~ '^\+998\d{9}$' then raise exception 'bad_input'; end if;
  select * into tr from public.liga_test_runs x where x.code = t.code and x.cand_phone = p_phone;
  if tr.id is not null and tr.finished_at is not null then raise exception 'already_done'; end if;
  if tr.id is null then
    insert into public.liga_test_runs(code, cand_name, cand_phone) values (t.code, left(trim(p_name), 80), p_phone) returning * into tr;
  end if;
  select id into rid from public.liga_runs where kind = 'test' and ref = tr.id::text;
  if rid is null then
    npv := round(t.n * 0.4); ncalc := round(t.n * 0.3);
    q := public.liga_draw(public.liga_all_pools(), 'test|' || tr.id, npv, ncalc, t.n - npv - ncalc, 0);
    rid := public.liga_run_new('test', null, tr.id::text, null, coalesce(p_lang, t.lang, 'uz'), q);
  end if;
  update public.liga_runs set secret_hash = public.liga_hash(sec) where id = rid;
  if now() > tr.started_at + make_interval(mins => t.minutes + 1) then perform public.liga_run_finish_sys(rid); raise exception 'test_closed'; end if;
  return public.liga_run_view(rid) || jsonb_build_object('secret', sec, 'minutes', t.minutes, 'test_started', tr.started_at, 'title', t.title);
end $$;

-- savol ekranda ko'rindi: vaqt shu paytdan hisoblanadi; qolgan soniyani qaytaradi
create or replace function public.liga_run_show(p_id uuid, p_token text, p_run uuid, p_k int, p_secret text default null)
returns int language plpgsql security definer set search_path = public as $$
declare r public.liga_runs; s timestamptz;
begin
  r := public.liga_run_auth(p_run, p_id, p_token, p_secret);
  perform public.liga_run_sweep(p_run);
  update public.liga_run_ans set shown_at = coalesce(shown_at, now()) where run_id = p_run and k = p_k and answered_at is null returning shown_at into s;
  if s is null then return 0; end if;
  return greatest(0, 60 - extract(epoch from now() - s))::int;
end $$;

create or replace function public.liga_run_answer(p_id uuid, p_token text, p_run uuid, p_k int, p_ans jsonb, p_secret text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.liga_runs; a public.liga_run_ans; b public.liga_bank; v_ok boolean; v_why text := ''; v_g int := 0; c int; mins int; st timestamptz;
begin
  r := public.liga_run_auth(p_run, p_id, p_token, p_secret);
  select * into a from public.liga_run_ans where run_id = p_run and k = p_k for update;
  if a.run_id is null then raise exception 'bad_input'; end if;
  select * into b from public.liga_bank where id = a.qid;
  if a.answered_at is not null then
    return public.liga_run_state(p_run) || jsonb_build_object('ok', a.ok, 'why', coalesce(a.why, ''), 'got', a.gain, 'reveal', public.liga_q_reveal(b, r.lang), 'dup', true);
  end if;
  if r.finished_at is not null then raise exception 'already_done'; end if;
  if r.kind = 'stage' then
    if r.week_id is distinct from public.liga_cur_week_id() or not public.liga_stage_window(public.liga_my_group(r.player_id), r.ref::int, 2) then raise exception 'stage_closed'; end if;
  elsif r.kind = 'test' then
    select t.minutes, tr.started_at into mins, st from public.liga_test_runs tr join public.liga_tests t on t.code = tr.code where tr.id = r.ref::uuid;
    if now() > st + make_interval(mins => mins + 1) then perform public.liga_run_finish_sys(p_run); raise exception 'test_closed'; end if;
  elsif r.kind = 'final' then
    if public.liga_today() <> public.liga_final_date(r.ref) or (now() at time zone 'Asia/Tashkent')::time > time '13:05' then
      perform public.liga_run_finish_sys(p_run); raise exception 'final_closed'; end if;
  end if;
  if a.shown_at is null then a.shown_at := now(); end if;
  if coalesce((p_ans->>'left')::boolean, false) then v_ok := false; v_why := 'left';
  elsif now() > a.shown_at + interval '65 seconds' then v_ok := false; v_why := 'time';
  else v_ok := public.liga_q_ok(b, p_ans); end if;
  if v_ok then
    c := r.combo + 1;
    if r.kind = 'stage' then v_g := 10 + case when c >= 3 then 5 else 0 end + case when c >= 7 then 5 else 0 end; end if;
  else c := 0; end if;
  update public.liga_run_ans set shown_at = a.shown_at, answered_at = now(), ok = v_ok, why = nullif(v_why, ''), gain = v_g, ans = p_ans
    where run_id = p_run and k = p_k;
  update public.liga_runs set combo = c, right_n = right_n + v_ok::int, done_n = done_n + 1, gain = gain + v_g where id = p_run returning * into r;
  if r.kind = 'final' then
    insert into public.liga_final_live(month, player_id, group_code, right_n, done_n) values (r.ref, r.player_id, public.liga_my_group(r.player_id), r.right_n, r.done_n)
      on conflict (month, player_id) do update set right_n = excluded.right_n, done_n = excluded.done_n, updated_at = now();
  end if;
  perform public.liga_run_settle(p_run);
  return public.liga_run_state(p_run) || jsonb_build_object('ok', v_ok, 'why', v_why, 'got', v_g, 'reveal', public.liga_q_reveal(b, r.lang));
end $$;

-- o'yinchi chiqib ketdi: bosqich — keyin davom etadi; final/duel/test — natija shu holatda yuboriladi
create or replace function public.liga_run_finish(p_id uuid, p_token text, p_run uuid, p_secret text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.liga_runs;
begin
  r := public.liga_run_auth(p_run, p_id, p_token, p_secret);
  if r.kind = 'stage' then perform public.liga_run_sweep(p_run); else perform public.liga_run_finish_sys(p_run); end if;
  return public.liga_run_state(p_run);
end $$;

-- shu hafta bosqichlar holati (bosh sahifa, xarita)
create or replace function public.liga_stage_status(p_id uuid, p_token text)
returns table(si int, n int, done_n int, right_n int, gain int, bonus int, stars int, finished boolean)
language plpgsql security definer set search_path = public as $$
declare rr record;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  for rr in select id from public.liga_runs where player_id = p_id and kind = 'stage' and week_id = public.liga_cur_week_id() and finished_at is null loop
    perform public.liga_run_sweep(rr.id);
  end loop;
  return query select r.ref::int, array_length(r.qids, 1), r.done_n, r.right_n, r.gain, r.bonus, r.stars, r.finished_at is not null
    from public.liga_runs r where r.player_id = p_id and r.kind = 'stage' and r.week_id = public.liga_cur_week_id();
end $$;

-- eski, mijozga ishongan funksiyalar yopiladi
revoke all on function public.liga_final_submit(uuid,text,integer,integer), public.liga_final_tick(uuid,text,integer,integer),
  public.liga_duel_submit(text,uuid,text,integer,integer), public.liga_test_finish(uuid,integer,integer,integer,jsonb),
  public.liga_test_start(text,text,text) from public, anon, authenticated;

-- liga_save: bosqich ballari va bosqichlar soni endi faqat serverda (mijoz yuborgani e'tiborsiz)
create or replace function public.liga_save(p_id uuid, p_token text, p_xp integer, p_stages integer, p_streak integer, p_first text, p_last text,
  p_week_daily integer, p_week_blitz integer, p_week_bonus integer, p_week_stages jsonb, p_region text default null, p_acc_ok integer default 0, p_acc_total integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare wid text := public.liga_cur_week_id();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  update public.safari_players set xp = greatest(xp, p_xp, 0),
    week_stages = case when week_id = wid then coalesce(week_stages, '{}'::jsonb) else '{}'::jsonb end, week_id = wid,
    week_daily = greatest(0, coalesce(p_week_daily,0)), week_blitz = greatest(0, coalesce(p_week_blitz,0)), week_bonus = greatest(0, coalesce(p_week_bonus,0)),
    streak = greatest(0, p_streak), last_active = now(),
    first_name = coalesce(nullif(trim(p_first),''), first_name), last_name = coalesce(p_last, last_name),
    region = coalesce(public.liga_region_ok(p_region), region),
    acc_ok = greatest(0, coalesce(p_acc_ok,0)), acc_total = greatest(0, coalesce(p_acc_total,0))
  where id = p_id;
end $$;

-- =============== cheklar: kunlik cheklov yo'q ===============
create or replace function public.liga_receipt_sys(p_player uuid, p_months integer, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns table(id bigint, paid_until date, dup boolean) language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 6)); pr int; g text; prev date; nu date; inv bigint;
begin
  if exists (select 1 from public.liga_invoices i where i.tg_file_uid = p_uid) then
    return query select null::bigint, null::date, true; return;
  end if;
  select s.group_code, s.paid_until into g, prev from public.safari_players s where s.id = p_player;
  if g is null then raise exception 'not_found'; end if;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_player, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, paid_at, tg_file_uid, tg_file_id, tg_chat_id)
    values (g, 1, m, pr::bigint * m, 'check', 'karta (bot)', p_player, p_image, prev, now(), p_uid, p_file_id, p_chat) returning liga_invoices.id into inv;
  return query select inv, nu, false;
end $$;

create or replace function public.liga_receipt_submit(p_id uuid, p_token text, p_months integer, p_image text)
returns table(id bigint, paid_until date) language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 6)); pr int; g text; prev date; nu date; inv bigint;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_image is null or p_image !~ '^data:image/(jpeg|png|webp);base64,' or length(p_image) > 1500000 then raise exception 'bad_image'; end if;
  select s.group_code, s.paid_until into g, prev from public.safari_players s where s.id = p_id;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_id, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, paid_at)
    values (g, 1, m, pr::bigint * m, 'check', 'karta', p_id, p_image, prev, now()) returning liga_invoices.id into inv;
  begin perform public.liga_bot_call('receipt:' || inv); exception when others then null; end;
  return query select inv, nu;
end $$;

-- =============== Telegram orqali kirish (bir nechta qurilma) ===============
create table if not exists public.liga_tokens(token_hash text primary key, player_id uuid not null references public.safari_players(id) on delete cascade,
  created_at timestamptz not null default now(), via text);
alter table public.liga_tokens enable row level security;
create index if not exists liga_tokens_player on public.liga_tokens(player_id);

create or replace function public.liga_auth(p_id uuid, p_token text) returns boolean language sql stable security definer set search_path = public as $$
  select p_token is not null and (
    exists (select 1 from public.safari_players where id = p_id and token_hash = public.liga_hash(p_token))
    or exists (select 1 from public.liga_tokens where player_id = p_id and token_hash = public.liga_hash(p_token)))
$$;

create or replace function public.liga_token_issue_sys(p_player uuid, p_via text) returns text
language plpgsql security definer set search_path = public as $$
declare tok text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  insert into public.liga_tokens(token_hash, player_id, via) values (public.liga_hash(tok), p_player, p_via);
  return tok;
end $$;

create or replace function public.liga_profile_sys(p_player uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'first', s.first_name, 'last', s.last_name, 'phone', s.phone, 'region', s.region,
    'group', s.group_code, 'lang', s.lang, 'xp', s.xp, 'ref_code', s.ref_code) from public.safari_players s where s.id = p_player
$$;

-- Telegram ichida: tasdiqlangan Telegram ID bo'yicha (bot initData ni tekshiradi)
create or replace function public.liga_tg_login_sys(p_tg bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from public.safari_players where tg_user_id = p_tg order by last_active desc nulls last limit 1;
  if pid is null then return null; end if;
  return public.liga_profile_sys(pid) || jsonb_build_object('token', public.liga_token_issue_sys(pid, 'telegram'));
end $$;

-- brauzer / Android: kod → bot /start login_KOD → ilova natijani oladi
create table if not exists public.liga_login(code text primary key, created_at timestamptz not null default now(), player_id uuid, token text, tg bigint);
alter table public.liga_login enable row level security;

create or replace function public.liga_login_begin() returns text language plpgsql security definer set search_path = public as $$
declare c text := encode(extensions.gen_random_bytes(8), 'hex');
begin
  if (select count(*) from public.liga_login where created_at > now() - interval '1 minute') > 60 then raise exception 'too_many'; end if;
  insert into public.liga_login(code) values (c);
  return 'login_' || c;
end $$;

create or replace function public.liga_login_bind_sys(p_code text, p_tg bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid; l public.liga_login;
begin
  select * into l from public.liga_login where code = p_code and created_at > now() - interval '15 minutes' and player_id is null;
  if l.code is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select id into pid from public.safari_players where tg_user_id = p_tg order by last_active desc nulls last limit 1;
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'no_player'); end if;
  update public.liga_login set player_id = pid, tg = p_tg, token = public.liga_token_issue_sys(pid, 'login') where code = p_code;
  return jsonb_build_object('ok', true) || public.liga_profile_sys(pid);
end $$;

create or replace function public.liga_login_poll(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.liga_login;
begin
  select * into l from public.liga_login where code = regexp_replace(coalesce(p_code, ''), '^login_', '') and created_at > now() - interval '15 minutes';
  if l.code is null or l.token is null then return null; end if;
  update public.liga_login set token = null where code = l.code;
  return public.liga_profile_sys(l.player_id) || jsonb_build_object('token', l.token);
end $$;

-- =============== soliq taqvimi ===============
create table if not exists public.liga_tax_cal(id bigserial primary key, day int not null check (day between 1 and 31), months int[],
  title_uz text not null, title_ru text, topic text, active boolean not null default true, created_at timestamptz not null default now());
alter table public.liga_tax_cal enable row level security;
alter table public.safari_players add column if not exists tax_remind boolean not null default true;
insert into public.liga_tax_cal(day, months, title_uz, title_ru, topic)
  select * from (values
    (15, null::int[], 'JShDS va ijtimoiy soliq: hisobot va to''lov (o''tgan oy uchun)', 'НДФЛ и социальный налог: отчёт и уплата (за прошлый месяц)', 'ish'),
    (20, null::int[], 'QQS: hisobot va to''lov (o''tgan oy uchun)', 'НДС: отчёт и уплата (за прошлый месяц)', 'qqs')) v
  where not exists (select 1 from public.liga_tax_cal);

create or replace function public.liga_tax_cal_list() returns table(id bigint, day int, months int[], title_uz text, title_ru text, topic text, active boolean)
language sql stable security definer set search_path = public as $$
  select id, day, months, title_uz, title_ru, topic, active from public.liga_tax_cal order by day, id $$;
create or replace function public.liga_tax_cal_save(p_pin text, p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; ms int[];
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  if (p->>'day') !~ '^\d+$' or (p->>'day')::int not between 1 and 31 or length(trim(coalesce(p->>'title_uz',''))) < 3 then raise exception 'bad_input'; end if;
  if jsonb_typeof(p->'months') = 'array' and jsonb_array_length(p->'months') > 0 then
    select array_agg(x::int) into ms from jsonb_array_elements_text(p->'months') x where x ~ '^\d+$' and x::int between 1 and 12; end if;
  if p_id is null then
    insert into public.liga_tax_cal(day, months, title_uz, title_ru, topic) values ((p->>'day')::int, ms, left(trim(p->>'title_uz'),200), left(p->>'title_ru',200), p->>'topic')
      returning id into nid;
  else
    update public.liga_tax_cal set day = (p->>'day')::int, months = ms, title_uz = left(trim(p->>'title_uz'),200), title_ru = left(p->>'title_ru',200),
      topic = p->>'topic', active = coalesce((p->>'active')::boolean, true) where id = p_id returning id into nid;
  end if;
  return nid;
end $$;
create or replace function public.liga_set_tax_remind(p_id uuid, p_token text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  update public.safari_players set tax_remind = coalesce(p_on, true) where id = p_id;
end $$;
create or replace function public.liga_tax_remind_list() returns table(tg bigint, first_name text, lang text)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, coalesce(s.lang,'uz') from public.safari_players s
  where s.tg_user_id is not null and s.tax_remind and public.liga_player_ok(s.id) $$;

-- =============== qonun yangiliklari ===============
create table if not exists public.liga_news(id bigserial primary key, created_at timestamptz not null default now(),
  title_uz text not null, title_ru text, body_uz text not null, body_ru text, url text, qs jsonb not null default '[]'::jsonb,
  active boolean not null default true, posted_at timestamptz);
alter table public.liga_news enable row level security;
create or replace function public.liga_news_list() returns table(id bigint, created_at timestamptz, title_uz text, title_ru text, body_uz text, body_ru text, url text, qs jsonb)
language sql stable security definer set search_path = public as $$
  select id, created_at, title_uz, title_ru, body_uz, body_ru, url, qs from public.liga_news where active order by created_at desc limit 30 $$;
create or replace function public.liga_news_admin(p_pin text) returns setof public.liga_news
language plpgsql stable security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then return; end if;
  return query select * from public.liga_news order by created_at desc limit 100;
end $$;
create or replace function public.liga_news_save(p_pin text, p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; qs jsonb := coalesce(p->'qs', '[]'::jsonb);
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  if length(trim(coalesce(p->>'title_uz',''))) < 5 or length(trim(coalesce(p->>'body_uz',''))) < 10 then raise exception 'bad_input'; end if;
  if jsonb_typeof(qs) <> 'array' or exists (select 1 from jsonb_array_elements(qs) x where jsonb_typeof(x->'o') <> 'array'
      or jsonb_array_length(x->'o') not between 2 and 5 or (x->>'a') !~ '^\d+$' or (x->>'a')::int >= jsonb_array_length(x->'o') or length(coalesce(x->>'q','')) < 5)
    then raise exception 'bad_input'; end if;
  if p_id is null then
    insert into public.liga_news(title_uz, title_ru, body_uz, body_ru, url, qs) values (left(trim(p->>'title_uz'),200), left(p->>'title_ru',200),
      left(trim(p->>'body_uz'),3000), left(p->>'body_ru',3000), left(p->>'url',500), qs) returning id into nid;
  else
    update public.liga_news set title_uz = left(trim(p->>'title_uz'),200), title_ru = left(p->>'title_ru',200), body_uz = left(trim(p->>'body_uz'),3000),
      body_ru = left(p->>'body_ru',3000), url = left(p->>'url',500), qs = qs, active = coalesce((p->>'active')::boolean, true) where id = p_id returning id into nid;
  end if;
  return nid;
end $$;

-- =============== jamoalar bellashuvi (haftalik, juft-juft) ===============
create table if not exists public.liga_matches(week_id text not null, a_code text not null, b_code text not null, a_xp int, b_xp int,
  done boolean not null default false, primary key (week_id, a_code));
alter table public.liga_matches enable row level security;

-- jamoa bali: haftaning eng yaxshi 3 o'yinchisi yig'indisi
create or replace function public.liga_team_xp(p_code text, p_week text) returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(x), 0)::int from (
    select coalesce(r.week_xp, 0) x from public.liga_week_results r where r.group_code = p_code and r.week_id = p_week order by r.week_xp desc limit 3) y
$$;

-- dushanba: juftlash (o'tgan hafta kuchi bo'yicha qo'shnilar); 2 tadan kam faol o'yinchisi bor jamoa qatnashmaydi
create or replace function public.liga_match_pair_sys() returns table(a_code text, b_code text)
language plpgsql security definer set search_path = public as $$
declare wid text := public.liga_cur_week_id(); lw text := public.liga_last_week_id(); arr text[]; i int;
begin
  if not exists (select 1 from public.liga_matches m where m.week_id = wid) then
    select array_agg(code order by sc desc, code) into arr from (
      select g.code, public.liga_team_xp(g.code, lw) sc from public.liga_groups g
      where g.active and (select count(*) from public.safari_players s where s.group_code = g.code and public.liga_player_ok(s.id)) >= 2) z;
    i := 1;
    while arr is not null and i + 1 <= array_length(arr, 1) loop
      insert into public.liga_matches(week_id, a_code, b_code) values (wid, arr[i], arr[i + 1]) on conflict do nothing;
      i := i + 2;
    end loop;
  end if;
  return query select m.a_code, m.b_code from public.liga_matches m where m.week_id = wid;
end $$;

-- juma 12:00 dan keyin: o'tgan hafta bellashuvlari yakuni
create or replace function public.liga_match_close_sys() returns table(a_code text, b_code text, a_xp int, b_xp int)
language plpgsql security definer set search_path = public as $$
declare lw text := public.liga_last_week_id();
begin
  update public.liga_matches m set a_xp = public.liga_team_xp(m.a_code, lw), b_xp = public.liga_team_xp(m.b_code, lw), done = true
    where m.week_id = lw and not m.done;
  return query select m.a_code, m.b_code, m.a_xp, m.b_xp from public.liga_matches m where m.week_id = lw;
end $$;

-- ilova: mening jamoam bellashuvi (hafta davomida ballar yashirin, faqat nechta kishi o'ynagani)
create or replace function public.liga_match_info(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g text := public.liga_my_group(p_id); wid text := public.liga_cur_week_id(); lw text := public.liga_last_week_id(); cur jsonb; prev jsonb;
begin
  select jsonb_build_object('me', g, 'opp', case when m.a_code = g then m.b_code else m.a_code end,
    'opp_name', (select name from public.liga_groups where code = case when m.a_code = g then m.b_code else m.a_code end),
    'opp_region', (select region from public.liga_groups where code = case when m.a_code = g then m.b_code else m.a_code end),
    'my_played', (select count(*) from public.safari_players s where s.group_code = g and s.week_id = wid and coalesce(s.week_xp,0) > 0),
    'opp_played', (select count(*) from public.safari_players s where s.group_code = case when m.a_code = g then m.b_code else m.a_code end and s.week_id = wid and coalesce(s.week_xp,0) > 0))
    into cur from public.liga_matches m where m.week_id = wid and (m.a_code = g or m.b_code = g);
  select jsonb_build_object('opp_name', (select name from public.liga_groups where code = case when m.a_code = g then m.b_code else m.a_code end),
    'my_xp', case when m.a_code = g then m.a_xp else m.b_xp end, 'opp_xp', case when m.a_code = g then m.b_xp else m.a_xp end)
    into prev from public.liga_matches m where m.week_id = lw and m.done and (m.a_code = g or m.b_code = g);
  return jsonb_build_object('cur', cur, 'prev', prev);
end $$;

-- =============== huquqlar ===============
revoke all on function public.liga_close_hour(date), public.liga_stage_window(text,int,int), public.liga_q_pub(public.liga_bank,text), public.liga_q_reveal(public.liga_bank,text),
  public.liga_q_ok(public.liga_bank,jsonb), public.liga_draw(text[],text,int,int,int,int), public.liga_run_new(text,uuid,text,text,text,text[]),
  public.liga_run_state(uuid), public.liga_run_view(uuid), public.liga_run_auth(uuid,uuid,text,text), public.liga_stage_score(uuid,int,text,int),
  public.liga_run_close(uuid), public.liga_run_settle(uuid), public.liga_run_sweep(uuid), public.liga_run_finish_sys(uuid),
  public.liga_token_issue_sys(uuid,text), public.liga_profile_sys(uuid), public.liga_tg_login_sys(bigint), public.liga_login_bind_sys(text,bigint),
  public.liga_tax_remind_list(), public.liga_team_xp(text,text), public.liga_match_pair_sys(), public.liga_match_close_sys()
  from public, anon, authenticated;
grant execute on function public.liga_tg_login_sys(bigint), public.liga_login_bind_sys(text,bigint), public.liga_tax_remind_list(),
  public.liga_match_pair_sys(), public.liga_match_close_sys(), public.liga_profile_sys(uuid) to service_role;
revoke all on function public.liga_stage_start(uuid,text,int,text), public.liga_final_start(uuid,text,text), public.liga_duel_start(uuid,text,text,text),
  public.liga_test_begin(text,text,text,text), public.liga_run_show(uuid,text,uuid,int,text), public.liga_run_answer(uuid,text,uuid,int,jsonb,text),
  public.liga_run_finish(uuid,text,uuid,text), public.liga_stage_status(uuid,text), public.liga_login_begin(), public.liga_login_poll(text),
  public.liga_tax_cal_list(), public.liga_tax_cal_save(text,bigint,jsonb), public.liga_set_tax_remind(uuid,text,boolean),
  public.liga_news_list(), public.liga_news_admin(text), public.liga_news_save(text,bigint,jsonb), public.liga_match_info(uuid) from public;
grant execute on function public.liga_stage_start(uuid,text,int,text), public.liga_final_start(uuid,text,text), public.liga_duel_start(uuid,text,text,text),
  public.liga_test_begin(text,text,text,text), public.liga_run_show(uuid,text,uuid,int,text), public.liga_run_answer(uuid,text,uuid,int,jsonb,text),
  public.liga_run_finish(uuid,text,uuid,text), public.liga_stage_status(uuid,text), public.liga_login_begin(), public.liga_login_poll(text),
  public.liga_tax_cal_list(), public.liga_tax_cal_save(text,bigint,jsonb), public.liga_set_tax_remind(uuid,text,boolean),
  public.liga_news_list(), public.liga_news_admin(text), public.liga_news_save(text,bigint,jsonb), public.liga_match_info(uuid) to anon, authenticated, service_role;
