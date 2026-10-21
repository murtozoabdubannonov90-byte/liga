-- 2026-10-21g · Sovrinli musobaqa qoidalari (Murtozo):
--  • ballar 22.10.2026 09:00 dan hisoblanadi (px_start_at) — oldingi o'yinlar reytingga kirmaydi;
--  • faqat to'lov qilganlar (paid_until ≥ bugun yoki admin telefoni) o'ynaydi — ligaga kirish 30 000 so'm;
--  • o'yin vaqti 40 soniya, har bir savolga ko'pi bilan 10 soniya (px_q_secs) — kechiksa xato;
--  • o'yin faqat 09:00–18:00 (Toshkent) boshlanadi;
--  • faqat telefonda (Telegram Android/iOS yoki Android ilova) — kompyuter/brauzer rad etiladi;
--  • savollar qiyinroq: provodkada 8 variant + o'tgan kunlar bosqichlarining qiyin provodkalari; schyotlarda 6 variant (bir guruhdan).
--  Ballar liga baliga / umumiy XP ga qo'shilmaydi (alohida liga_px_sess).

insert into public.liga_bot_config(key, value) values
  ('px_secs', '40'), ('px_q_secs', '10'), ('px_start_at', '2026-10-22T09:00:00+05:00'), ('px_open_from', '09:00'), ('px_open_to', '18:00')
on conflict (key) do update set value = excluded.value;

create or replace function public.liga_px_t0() returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce(nullif(public.liga_px_cfg('px_start_at', ''), '')::timestamptz, '-infinity'::timestamptz)
$$;

-- to'lov qilganmi (bepul davr va sinov rejimi hisobga olinmaydi)
create or replace function public.liga_px_paid(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.paid_until >= public.liga_today()
                       or s.phone = any(string_to_array(coalesce((select value from public.liga_bot_config where key = 'free_phones'), ''), ','))
                   from public.safari_players s where s.id = p_id), false)
$$;

create or replace function public.liga_px_month_pts(p_group text, p_mon text)
returns table(player_id uuid, pts bigint, games bigint)
language sql stable security definer set search_path = public as $$
  select x.player_id, sum(x.score)::bigint, count(*)::bigint
  from public.liga_px_sess x where x.group_code = p_group and x.mon = p_mon and x.done_n > 0 and x.started_at >= public.liga_px_t0()
  group by x.player_id
$$;

create or replace function public.liga_px_board(p_id uuid, p_scope text default 'month')
returns table(pos integer, name text, pts bigint, games bigint, me boolean, ok boolean)
language sql stable security definer set search_path = public as $$
  with g as (select coalesce(public.liga_my_group(p_id), 'ASOSIY') code),
  per as (select case p_scope when 'day' then public.liga_today()
                              when 'week' then public.liga_today() - (extract(isodow from public.liga_today())::int - 1)
                              else date_trunc('month', public.liga_today())::date end d0),
  agg as (
    select x.player_id, sum(x.score)::bigint pts, count(*)::bigint games
    from public.liga_px_sess x, g, per where x.group_code = g.code and x.day >= per.d0 and x.done_n > 0 and x.started_at >= public.liga_px_t0()
    group by x.player_id having sum(x.score) > 0),
  r as (select a.*, (rank() over (order by a.pts desc))::int pos from agg a)
  select r.pos, public.liga_px_pname(r.player_id), r.pts, r.games, r.player_id = p_id, public.liga_px_paid(r.player_id)
    from r where r.pos <= 50 or r.player_id = p_id order by r.pos, r.games desc
$$;

create or replace function public.liga_px_board_sys(p_group text default 'ASOSIY')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mon', public.liga_px_mon(), 'fund', public.liga_px_fund(p_group, public.liga_px_mon()), 'split', to_jsonb(public.liga_px_split()),
    'players', (select count(*) from public.liga_px_month_pts(p_group, public.liga_px_mon())),
    'today_games', (select count(*) from public.liga_px_sess x where x.group_code = p_group and x.day = public.liga_today() and x.done_n > 0 and x.started_at >= public.liga_px_t0()),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('name', public.liga_px_pname(m.player_id), 'pts', m.pts) order by m.pts desc), '[]')
              from (select * from public.liga_px_month_pts(p_group, public.liga_px_mon()) where pts > 0 order by pts desc limit 5) m))
$$;

-- oy yakuni: sovrin faqat to'lov qilganlarga
create or replace function public.liga_px_close_month_sys(p_mon text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_mon text := coalesce(p_mon, to_char(date_trunc('month', public.liga_today()) - interval '1 day', 'YYYY-MM'));
        fund bigint; sp int[]; r record; i int := 0;
begin
  if v_mon >= public.liga_px_mon() then return 0; end if;
  if exists (select 1 from public.liga_px_win w where w.mon = v_mon and w.group_code = 'ASOSIY') then return 0; end if;
  fund := public.liga_px_fund('ASOSIY', v_mon); sp := public.liga_px_split();
  for r in select m.player_id, m.pts from public.liga_px_month_pts('ASOSIY', v_mon) m
            where m.pts > 0 and public.liga_px_paid(m.player_id) order by m.pts desc, m.games asc limit coalesce(array_length(sp, 1), 3) loop
    i := i + 1;
    insert into public.liga_px_win(mon, group_code, pos, player_id, name, pts, amount)
    values (v_mon, 'ASOSIY', i, r.player_id, public.liga_px_pname(r.player_id), r.pts, fund * coalesce(sp[i], 0) / 100);
  end loop;
  return i;
end $$;

-- savol: qiyinroq
create or replace function public.liga_px_q(p_kind text, p_seen text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; c record; lb record; opts text[]; extra text[]; m text; use_lb boolean;
begin
  if p_kind = 'pv' then
    -- yarmi — o'tgan kunlar bosqichlarining qiyin provodkalari (javoblari bosqich yopilgach ochiq), yarmi — o'z bazasi; 8 variant
    use_lb := random() < 0.5;
    if use_lb then
      select l.id, l.dt, l.kt, l.uz->'o' o into lb from public.liga_bank l
       where l.active and l.t = 'pv' and l.pool ~ '^d2026\d{4}$' and to_date(substr(l.pool, 2), 'YYYYMMDD') < public.liga_today()
         and 'L' || l.id <> all(coalesce(p_seen, '{}')) order by random() limit 1;
      if found then
        select array_agg(x) into opts from jsonb_array_elements_text(lb.o) x;
        select array_agg(code) into extra from (select code from public.liga_px_acc where code <> all(opts) order by random() limit 8 - coalesce(array_length(opts, 1), 0)) z;
        select array_agg(x order by random()) into opts from unnest(opts || coalesce(extra, '{}')) x;
        return jsonb_build_object('id', 'L' || lb.id, 'lbid', lb.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', lb.dt, 'kt', lb.kt);
      end if;
    end if;
    select * into b from public.liga_px_bank where 'b' || id <> all(coalesce(p_seen, '{}')) order by random() limit 1;
    if not found then select * into b from public.liga_px_bank order by random() limit 1; end if;
    select array_agg(code) into extra from (select code from public.liga_px_acc where code <> all(b.o)
       order by (left(code, 1) in (left(b.dt, 1), left(b.kt, 1))) desc, random() limit 8 - coalesce(array_length(b.o, 1), 0)) z;
    select array_agg(x order by random()) into opts from unnest(b.o || coalesce(extra, '{}')) x;
    return jsonb_build_object('id', 'b' || b.id, 'bid', b.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', b.dt, 'kt', b.kt);
  elsif p_kind = 'acc' then
    select * into c from public.liga_px_acc where 'a' || code <> all(coalesce(p_seen, '{}')) order by random() limit 1;
    if not found then select * into c from public.liga_px_acc order by random() limit 1; end if;
    select array_agg(code) into opts from (
      select code from public.liga_px_acc where code <> c.code
       order by (left(code,2) = left(c.code,2)) desc, (left(code,1) = left(c.code,1)) desc, random() limit 5) z;
    select array_agg(x order by random()) into opts from unnest(opts || c.code) x;
    m := case when random() < 0.5 then 'c2n' else 'n2c' end;
    return jsonb_build_object('id', 'a' || c.code, 't', 'acc', 'mode', m, 'code', c.code, 'o', to_jsonb(opts),
                              'a', array_position(opts, c.code) - 1);
  else
    select * into c from public.liga_px_acc where side <> 'n' and 's' || code <> all(coalesce(p_seen, '{}')) order by random() limit 1;
    if not found then select * into c from public.liga_px_acc where side <> 'n' order by random() limit 1; end if;
    return jsonb_build_object('id', 's' || c.code, 't', 'side', 'code', c.code, 'o', '["a","l","e","r","x"]'::jsonb,
                              'a', array_position(array['a','l','e','r','x'], c.side) - 1);
  end if;
end $$;

create or replace function public.liga_px_pub(p_cur jsonb, p_lang text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when p_cur is null then null
    when p_cur->>'t' = 'pv' and p_cur ? 'lbid' then jsonb_build_object('t', 'pv',
      'q', (select case when p_lang = 'ru' and l.ru ? 'q' then l.ru->>'q' else l.uz->>'q' end from public.liga_bank l where l.id = p_cur->>'lbid'), 'o', p_cur->'o',
      'qs', public.liga_px_cfg('px_q_secs', '10')::int)
    when p_cur->>'t' = 'pv' then jsonb_build_object('t', 'pv', 'q', (select case when p_lang = 'ru' then q_ru else q_uz end from public.liga_px_bank where id = (p_cur->>'bid')::int), 'o', p_cur->'o',
      'qs', public.liga_px_cfg('px_q_secs', '10')::int)
    when p_cur->>'t' = 'acc' and p_cur->>'mode' = 'c2n' then jsonb_build_object('t', 'acc', 'mode', 'c2n', 'ask', p_cur->'code',
      'o', (select jsonb_agg((select case when p_lang = 'ru' then name_ru else name_uz end from public.liga_px_acc where code = x) order by o) from jsonb_array_elements_text(p_cur->'o') with ordinality u(x, o)),
      'qs', public.liga_px_cfg('px_q_secs', '10')::int)
    when p_cur->>'t' = 'acc' then jsonb_build_object('t', 'acc', 'mode', 'n2c',
      'ask', (select case when p_lang = 'ru' then name_ru else name_uz end from public.liga_px_acc where code = p_cur->>'code'), 'o', p_cur->'o',
      'qs', public.liga_px_cfg('px_q_secs', '10')::int)
    else jsonb_build_object('t', 'side', 'code', p_cur->'code', 'o', p_cur->'o', 'qs', public.liga_px_cfg('px_q_secs', '10')::int) end
$$;

-- start: to'lov, vaqt oralig'i, telefon
drop function if exists public.liga_px_start(uuid, text, text);
create or replace function public.liga_px_start(p_id uuid, p_token text, p_kind text, p_platform text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; secs int := public.liga_px_cfg('px_secs', '40')::int; g text; v_lang text; q jsonb; tn time := (now() at time zone 'Asia/Tashkent')::time;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_kind not in ('pv', 'acc', 'side') then raise exception 'bad_input'; end if;
  if public.liga_px_cfg('px_on', 'on') <> 'on' then raise exception 'px_off'; end if;
  if coalesce(p_platform, '') not in ('android', 'ios', 'android_app', 'mobile_web') then raise exception 'px_phone_only'; end if;
  if not public.liga_px_paid(p_id) then raise exception 'px_unpaid'; end if;
  if now() < public.liga_px_t0() then raise exception 'px_not_started'; end if;
  if tn < public.liga_px_cfg('px_open_from', '09:00')::time or tn > public.liga_px_cfg('px_open_to', '18:00')::time - make_interval(secs => secs) then raise exception 'px_hours'; end if;
  if (select count(*) from public.liga_px_sess where player_id = p_id and started_at > now() - interval '1 minute') >= 6 then raise exception 'too_many'; end if;
  update public.liga_px_sess set finished = true where player_id = p_id and not finished;
  select coalesce(sp.group_code, 'ASOSIY'), coalesce(sp.lang, 'uz') into g, v_lang from public.safari_players sp where sp.id = p_id;
  q := public.liga_px_q(p_kind, '{}');
  insert into public.liga_px_sess(player_id, group_code, kind, ends_at, day, mon, cur, q_at, seen)
  values (p_id, g, p_kind, now() + make_interval(secs => secs), public.liga_today(), public.liga_px_mon(), q, now(), array[q->>'id'])
  returning * into s;
  return jsonb_build_object('sid', s.id, 'kind', s.kind, 'secs', secs, 'left_ms', secs * 1000, 'k', 0, 'score', 0, 'right_n', 0, 'done_n', 0, 'combo', 0,
                            'qs', public.liga_px_cfg('px_q_secs', '10')::int, 'q', public.liga_px_pub(q, v_lang));
end $$;
grant execute on function public.liga_px_start(uuid, text, text, text) to anon, authenticated;

-- javob: savolga 10 soniyadan ko'p o'ylansa — xato ('slow'); qiyin provodka izohi liga_bank dan
create or replace function public.liga_px_answer(p_id uuid, p_token text, p_sid uuid, p_k integer, p_ans jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; ok boolean; fast boolean; slow boolean; pts int := 0; q jsonb; v_lang text; ans jsonb; e text; left_ms int;
        qs int := public.liga_px_cfg('px_q_secs', '10')::int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into s from public.liga_px_sess where id = p_sid and player_id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select coalesce(sp.lang, 'uz') into v_lang from public.safari_players sp where sp.id = p_id;
  left_ms := greatest(0, (extract(epoch from s.ends_at - now()) * 1000)::int);
  if s.finished or p_k <> s.done_n or s.cur is null or now() > s.ends_at + interval '2 seconds' then
    if not s.finished and now() > s.ends_at + interval '2 seconds' then update public.liga_px_sess set finished = true, cur = null where id = s.id; end if;
    return jsonb_build_object('stale', true, 'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo,
                              'left_ms', left_ms, 'over', s.finished or now() > s.ends_at, 'q', case when s.finished or now() > s.ends_at then null else public.liga_px_pub(s.cur, v_lang) end);
  end if;
  fast := now() - s.q_at < interval '350 milliseconds';
  slow := now() - s.q_at > make_interval(secs => qs + 1);
  if s.cur->>'t' = 'pv' then
    ok := coalesce(p_ans->>'dt', '') = s.cur->>'dt' and coalesce(p_ans->>'kt', '') = s.cur->>'kt';
    ans := jsonb_build_object('dt', s.cur->'dt', 'kt', s.cur->'kt');
    if s.cur ? 'lbid' then
      select case when v_lang = 'ru' and l.ru ? 'e' then l.ru->>'e' else l.uz->>'e' end into e from public.liga_bank l where l.id = s.cur->>'lbid';
    else
      select case when v_lang = 'ru' then e_ru else e_uz end into e from public.liga_px_bank where id = (s.cur->>'bid')::int;
    end if;
  else
    ok := (p_ans->>'pick') is not null and (p_ans->>'pick') ~ '^\d+$' and (p_ans->>'pick')::int = (s.cur->>'a')::int;
    ans := jsonb_build_object('a', s.cur->'a', 'code', s.cur->'code');
  end if;
  if fast or slow then ok := false; end if;
  if ok then s.combo := s.combo + 1; pts := public.liga_px_pts(s.combo); else s.combo := 0; end if;
  s.score := s.score + pts; s.right_n := s.right_n + ok::int; s.done_n := s.done_n + 1; s.best_combo := greatest(s.best_combo, s.combo);
  q := case when now() < s.ends_at then public.liga_px_q(s.kind, s.seen) end;
  update public.liga_px_sess set score = s.score, right_n = s.right_n, done_n = s.done_n, combo = s.combo, best_combo = s.best_combo,
         cur = q, q_at = now(), seen = case when q is null then seen else seen || (q->>'id') end
   where id = s.id;
  return jsonb_build_object('ok', ok, 'why', case when fast then 'fast' when slow then 'slow' else '' end, 'ans', ans, 'e', coalesce(e, ''), 'got', pts,
                            'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo,
                            'left_ms', left_ms, 'over', q is null, 'q', public.liga_px_pub(q, v_lang));
end $$;

create or replace function public.liga_px_me(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g text; v_mon text := public.liga_px_mon(); d date := public.liga_today(); tot record; mp bigint; rk int; n int; streak int := 0; dd date;
        fund bigint; v_sp int[]; t0 timestamptz := public.liga_px_t0();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select coalesce(sp.group_code, 'ASOSIY') into g from public.safari_players sp where sp.id = p_id;
  select count(*) filter (where public.liga_px_done(x)) games, coalesce(sum(right_n), 0) rights, coalesce(sum(done_n), 0) answers,
         coalesce(max(score) filter (where kind = 'pv'), 0) b_pv, coalesce(max(score) filter (where kind = 'acc'), 0) b_acc,
         coalesce(max(score) filter (where kind = 'side'), 0) b_side,
         count(*) filter (where public.liga_px_done(x) and day = d) today_games, coalesce(sum(score) filter (where day = d), 0) today_pts
    into tot from public.liga_px_sess x where x.player_id = p_id and x.started_at >= t0;
  select m.pts into mp from public.liga_px_month_pts(g, v_mon) m where m.player_id = p_id;
  select count(*) + 1 into rk from public.liga_px_month_pts(g, v_mon) m where m.pts > coalesce(mp, 0);
  select count(*) into n from public.liga_px_month_pts(g, v_mon);
  dd := case when exists (select 1 from public.liga_px_sess where player_id = p_id and day = d and done_n > 0 and started_at >= t0) then d else d - 1 end;
  while exists (select 1 from public.liga_px_sess where player_id = p_id and day = dd and done_n > 0 and started_at >= t0) and streak < 400 loop streak := streak + 1; dd := dd - 1; end loop;
  fund := public.liga_px_fund(g, v_mon); v_sp := public.liga_px_split();
  return jsonb_build_object('mon', v_mon, 'secs', public.liga_px_cfg('px_secs', '40')::int, 'qs', public.liga_px_cfg('px_q_secs', '10')::int,
    'on', public.liga_px_cfg('px_on', 'on') = 'on',
    'start_at', case when t0 > '-infinity'::timestamptz then to_char(t0 at time zone 'Asia/Tashkent', 'YYYY-MM-DD"T"HH24:MI') end,
    'started', now() >= t0,
    'open_from', public.liga_px_cfg('px_open_from', '09:00'), 'open_to', public.liga_px_cfg('px_open_to', '18:00'),
    'end_day', to_char((date_trunc('month', d) + interval '1 month - 1 day')::date, 'YYYY-MM-DD'),
    'days_left', ((date_trunc('month', d) + interval '1 month - 1 day')::date - d) + 1,
    'today', jsonb_build_object('games', tot.today_games, 'pts', tot.today_pts),
    'month', jsonb_build_object('pts', coalesce(mp, 0), 'rank', case when coalesce(mp, 0) > 0 then rk end, 'n', n),
    'total', jsonb_build_object('games', tot.games, 'rights', tot.rights, 'answers', tot.answers, 'best', jsonb_build_object('pv', tot.b_pv, 'acc', tot.b_acc, 'side', tot.b_side)),
    'streak', streak, 'quests', '[]'::jsonb, 'ach', '[]'::jsonb,
    'fund', jsonb_build_object('amount', fund, 'split', to_jsonb(v_sp), 'prizes', (select coalesce(jsonb_agg(fund * u.x / 100 order by u.o), '[]') from unnest(v_sp) with ordinality u(x, o))),
    'eligible', public.liga_px_paid(p_id));
end $$;
