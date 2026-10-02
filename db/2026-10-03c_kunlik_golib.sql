-- Hisobchi Liga — 2026-10-03c
--  • Kunlik kuchli uchlik: har bosqich kuni jamoada bosqich bali bo'yicha (teng bo'lsa — tezroq) 1–3-o'rinlar
--  • Mukofot: keyingi ish kunidagi bosqichda har savolga qo'shimcha vaqt — 1-o'rin +10 s, 2-o'rin +7 s, 3-o'rin +4 s
--    (server o'lchaydi: ko'rsatish, javob muddati, ko'rilmay qolgan savollar)
--  • Ilova uchun: kecha/bugungi kuchli uchlik va mening imtiyozim (liga_day_info)
--  • Sinov rejimi: superadmin yoqsa, hamma bepul o'ynaydi (to'lov talab qilinmaydi)

alter table public.liga_runs add column if not exists extra_sec int not null default 0;

create or replace function public.liga_prev_workday(d date) returns date language sql immutable as $$
  select max(x)::date from generate_series(d - 7, d - 1, interval '1 day') x where extract(isodow from x) <= 5 $$;

-- jamoaning shu kundagi bosqich kuchli uchligi
create or replace function public.liga_day_top(p_code text, p_day date)
returns table(pos int, player_id uuid, name text, score int, ms int)
language sql stable security definer set search_path = public as $$
  select (row_number() over (order by (r.gain + r.bonus) desc, (r.finished_at is null), coalesce(r.ms, 2147483647), r.started_at))::int,
    s.id, trim(coalesce(s.first_name,'') || ' ' || left(coalesce(s.last_name,''),1) || '.'), r.gain + r.bonus, r.ms
  from public.liga_runs r join public.safari_players s on s.id = r.player_id
  where r.kind = 'stage' and s.group_code = p_code and (r.started_at at time zone 'Asia/Tashkent')::date = p_day and r.gain + r.bonus > 0
  order by 1 limit 3
$$;

-- bugungi qo'shimcha soniya: kechagi (oldingi ish kuni) o'rin bo'yicha
create or replace function public.liga_extra_sec(p_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case t.pos when 1 then 10 when 2 then 7 when 3 then 4 else 0 end
    from public.liga_day_top(public.liga_my_group(p_id), public.liga_prev_workday(public.liga_today())) t where t.player_id = p_id), 0)
$$;

-- ilova: kunlik kuchli uchlik va imtiyozim
create or replace function public.liga_day_info(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g text := public.liga_my_group(p_id); pd date := public.liga_prev_workday(public.liga_today()); td date := public.liga_today();
  closed boolean := (now() at time zone 'Asia/Tashkent')::time >= make_time(public.liga_close_hour(public.liga_today()), 0, 0) or extract(isodow from public.liga_today()) > 5;
begin
  return jsonb_build_object(
    'prev_day', pd,
    'prev_top', coalesce((select jsonb_agg(jsonb_build_object('pos', t.pos, 'name', t.name, 'me', t.player_id = p_id) order by t.pos) from public.liga_day_top(g, pd) t), '[]'::jsonb),
    'extra_today', public.liga_extra_sec(p_id),
    'today_closed', closed,
    'today_top', case when closed then coalesce((select jsonb_agg(jsonb_build_object('pos', t.pos, 'name', t.name, 'me', t.player_id = p_id) order by t.pos) from public.liga_day_top(g, td) t), '[]'::jsonb) else '[]'::jsonb end);
end $$;

-- bot uchun: bugungi kuchli uchlik (Telegram ID bilan)
create or replace function public.liga_day_top_sys(p_code text, p_day date)
returns table(pos int, player_id uuid, name text, score int, tg bigint, lang text)
language sql stable security definer set search_path = public as $$
  select t.pos, t.player_id, t.name, t.score, s.tg_user_id, coalesce(s.lang, 'uz') from public.liga_day_top(p_code, p_day) t join public.safari_players s on s.id = t.player_id
$$;

-- ---- server o'yinlari: qo'shimcha vaqt hisobga olinadi ----
create or replace function public.liga_run_sweep(p_run uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n int; ex int;
begin
  select extra_sec into ex from public.liga_runs where id = p_run;
  update public.liga_run_ans set ok = false, why = 'time', answered_at = now()
    where run_id = p_run and answered_at is null and shown_at is not null and shown_at < now() - make_interval(secs => 65 + coalesce(ex, 0));
  get diagnostics n = row_count;
  if n > 0 then
    update public.liga_runs set done_n = done_n + n, combo = 0 where id = p_run;
    perform public.liga_run_settle(p_run);
  end if;
end $$;

create or replace function public.liga_run_state(p_run uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('run', r.id, 'kind', r.kind, 'ref', r.ref, 'n', array_length(r.qids, 1), 'combo', r.combo, 'right_n', r.right_n,
    'done_n', r.done_n, 'gain', r.gain, 'bonus', r.bonus, 'stars', r.stars, 'finished', r.finished_at is not null, 'started_at', r.started_at, 'ms', r.ms,
    'qsec', 60 + r.extra_sec, 'extra_sec', r.extra_sec)
  from public.liga_runs r where r.id = p_run
$$;

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
    update public.liga_runs set extra_sec = public.liga_extra_sec(p_id) where id = rid;
  else
    update public.liga_runs set lang = case when p_lang = 'ru' then 'ru' else 'uz' end where id = rid;
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;

create or replace function public.liga_run_show(p_id uuid, p_token text, p_run uuid, p_k int, p_secret text default null)
returns int language plpgsql security definer set search_path = public as $$
declare r public.liga_runs; s timestamptz;
begin
  r := public.liga_run_auth(p_run, p_id, p_token, p_secret);
  perform public.liga_run_sweep(p_run);
  update public.liga_run_ans set shown_at = coalesce(shown_at, now()) where run_id = p_run and k = p_k and answered_at is null returning shown_at into s;
  if s is null then return 0; end if;
  return greatest(0, 60 + r.extra_sec - extract(epoch from now() - s))::int;
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
  elsif now() > a.shown_at + make_interval(secs => 65 + r.extra_sec) then v_ok := false; v_why := 'time';
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

-- ---- sinov rejimi (bepul) ----
create or replace function public.liga_trial() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'on' from public.liga_bot_config where key = 'trial_mode'), false) $$;

create or replace function public.liga_player_ok(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.liga_trial() or coalesce((select case when s.group_code <> 'ASOSIY' then public.liga_group_ok(s.group_code)
                               else coalesce(public.liga_eff_until(s.paid_until, s.created_at) >= public.liga_today(), false) end
                   from public.safari_players s where s.id = p_id), false)
$$;

create or replace function public.liga_super_set_trial(p_pin text, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  insert into public.liga_bot_config(key, value) values ('trial_mode', case when p_on then 'on' else 'off' end)
    on conflict (key) do update set value = excluded.value;
  return p_on;
end $$;

revoke all on function public.liga_prev_workday(date), public.liga_day_top(text,date), public.liga_extra_sec(uuid), public.liga_day_top_sys(text,date) from public, anon, authenticated;
grant execute on function public.liga_day_top_sys(text,date) to service_role;
revoke all on function public.liga_day_info(uuid), public.liga_trial(), public.liga_super_set_trial(text,boolean) from public;
grant execute on function public.liga_day_info(uuid), public.liga_trial(), public.liga_super_set_trial(text,boolean) to anon, authenticated, service_role;

-- sinov davri (1 hafta ichki sinov): hamma bepul o'ynaydi; o'chirish — Superadmin → Karta → «Sinov rejimini o'chirish»
insert into public.liga_bot_config(key, value) values ('trial_mode', 'on') on conflict (key) do update set value = excluded.value;
