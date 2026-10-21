-- 2026-10-21 · «Mashq zali» — ligadan ALOHIDA amaliy o'yinlar, vazifalar, yutuqlar, oylik reyting va sovrin jamg'armasi.
-- Kunlik bosqichlar, liga bali, duellar va kubokka HECH QANDAY ta'sir qilmaydi: alohida jadvallar (liga_px_*),
-- alohida ball (safari_players.xp / week_* ga yozilmaydi), mavjud funksiyalar o'zgartirilmagan.
--
-- O'yinlar (har biri 60 soniya, savollar va javoblar faqat serverda tekshiriladi):
--   pv   — «Debet ↔ Kredit»: muomala → Dt va Kt hisobvarag'i
--   acc  — «Schyotlar rejasi»: raqam → nom yoki nom → raqam (4 variant)
--   side — «Balans bo'limi»: hisobvaraq → Aktiv / Majburiyat / Kapital / Daromad / Xarajat
-- Ball: to'g'ri javob 10 + seriya bonusi (2-to'g'ri +2 … 6+ ketma-ket +10), xato 0. 0,35 soniyadan tez javob — xato (bot himoyasi).
-- Kunlik vazifalar: play3 (+30), right10 (+40), all3 (+50), combo7 (+30). Oylik reyting = o'yin ballari + vazifa ballari.
-- Sovrin jamg'armasi (faqat ASOSIY liga): px_fund_base + px_fund_per_pay × shu oyda tasdiqlangan shaxsiy to'lovlar (oylar soni).
--   Taqsimot px_split (50,30,20) — oy oxirida obunasi faol (liga_player_ok) eng yaxshi 3 kishi. G'oliblar liga_px_win da.

create table if not exists public.liga_px_bank (
  id int primary key, q_uz text not null, q_ru text not null, dt text not null, kt text not null,
  o text[] not null, e_uz text not null default '', e_ru text not null default '');
create table if not exists public.liga_px_acc (code text primary key, side text not null check (side in ('a','l','e','r','x','n')), name_uz text not null default '', name_ru text not null default '');
create table if not exists public.liga_px_sess (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.safari_players(id) on delete cascade,
  group_code text not null default 'ASOSIY', kind text not null check (kind in ('pv','acc','side')),
  started_at timestamptz not null default now(), ends_at timestamptz not null,
  day date not null, mon text not null,
  cur jsonb, q_at timestamptz, seen text[] not null default '{}',
  score int not null default 0, right_n int not null default 0, done_n int not null default 0,
  combo int not null default 0, best_combo int not null default 0, finished boolean not null default false);
create index if not exists liga_px_sess_mon on public.liga_px_sess (group_code, mon);
create index if not exists liga_px_sess_pl on public.liga_px_sess (player_id, day);
create table if not exists public.liga_px_quest (
  player_id uuid not null references public.safari_players(id) on delete cascade, day date not null, quest text not null,
  pts int not null, mon text not null, group_code text not null default 'ASOSIY', at timestamptz not null default now(),
  primary key (player_id, day, quest));
create index if not exists liga_px_quest_mon on public.liga_px_quest (group_code, mon);
create table if not exists public.liga_px_win (
  mon text not null, group_code text not null default 'ASOSIY', pos int not null, player_id uuid references public.safari_players(id) on delete set null,
  name text, pts int not null, amount bigint not null default 0, paid boolean not null default false, at timestamptz not null default now(),
  primary key (mon, group_code, pos));
alter table public.liga_px_bank enable row level security;
alter table public.liga_px_acc enable row level security;
alter table public.liga_px_sess enable row level security;
alter table public.liga_px_quest enable row level security;
alter table public.liga_px_win enable row level security;
revoke all on public.liga_px_bank, public.liga_px_acc, public.liga_px_sess, public.liga_px_quest, public.liga_px_win from anon, authenticated;

insert into public.liga_bot_config(key, value) values
  ('px_secs', '60'), ('px_fund_base', '0'), ('px_fund_per_pay', '5000'), ('px_split', '50,30,20'), ('px_on', 'on')
on conflict (key) do nothing;

-- ---------- yordamchilar ----------
create or replace function public.liga_px_cfg(p_key text, p_def text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.liga_bot_config where key = p_key), p_def)
$$;
create or replace function public.liga_px_mon(p_day date default null)
returns text language sql stable as $$ select to_char(coalesce(p_day, public.liga_today()), 'YYYY-MM') $$;
create or replace function public.liga_px_pname(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select trim(coalesce(first_name,'')||' '||left(coalesce(last_name,''),1)||case when coalesce(last_name,'') <> '' then '.' else '' end)
    from public.safari_players where id = p_id
$$;
-- seriya bonusi bilan ball
create or replace function public.liga_px_pts(p_combo int)
returns int language sql immutable as $$ select case when p_combo <= 0 then 0 else 10 + least(p_combo - 1, 5) * 2 end $$;

-- yangi savol (javobi bilan — faqat serverda qoladi)
create or replace function public.liga_px_q(p_kind text, p_seen text[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare b record; c record; opts text[]; m text;
begin
  if p_kind = 'pv' then
    select * into b from public.liga_px_bank where 'b' || id <> all(coalesce(p_seen, '{}')) order by random() limit 1;
    if not found then select * into b from public.liga_px_bank order by random() limit 1; end if;
    select array_agg(x order by random()) into opts from unnest(b.o) x;
    return jsonb_build_object('id', 'b' || b.id, 'bid', b.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', b.dt, 'kt', b.kt);
  elsif p_kind = 'acc' then
    select * into c from public.liga_px_acc where 'a' || code <> all(coalesce(p_seen, '{}')) order by random() limit 1;
    if not found then select * into c from public.liga_px_acc order by random() limit 1; end if;
    -- chalg'ituvchilar: imkon qadar shu guruhdan (birinchi raqami bir xil) — qiyinroq
    select array_agg(code) into opts from (
      select code from public.liga_px_acc where code <> c.code
       order by (left(code,1) = left(c.code,1)) desc, random() limit 3) z;
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
-- ilovaga beriladigan ko'rinish (javobsiz)
create or replace function public.liga_px_pub(p_cur jsonb, p_lang text)
returns jsonb language sql stable security definer set search_path = public as $$
  -- schyotlar o'yinida javobni bilib bo'lmasin: so'ralgan narsa bir ko'rinishda (raqam yoki nom), variantlar boshqasida
  select case when p_cur is null then null
    when p_cur->>'t' = 'pv' then jsonb_build_object('t', 'pv', 'q', (select case when p_lang = 'ru' then q_ru else q_uz end from public.liga_px_bank where id = (p_cur->>'bid')::int), 'o', p_cur->'o')
    when p_cur->>'t' = 'acc' and p_cur->>'mode' = 'c2n' then jsonb_build_object('t', 'acc', 'mode', 'c2n', 'ask', p_cur->'code',
      'o', (select jsonb_agg((select case when p_lang = 'ru' then name_ru else name_uz end from public.liga_px_acc where code = x) order by o) from jsonb_array_elements_text(p_cur->'o') with ordinality u(x, o)))
    when p_cur->>'t' = 'acc' then jsonb_build_object('t', 'acc', 'mode', 'n2c',
      'ask', (select case when p_lang = 'ru' then name_ru else name_uz end from public.liga_px_acc where code = p_cur->>'code'), 'o', p_cur->'o')
    else jsonb_build_object('t', 'side', 'code', p_cur->'code', 'o', p_cur->'o') end
$$;
-- tugagan (yoki vaqti o'tgan) o'yin
create or replace function public.liga_px_done(s public.liga_px_sess)
returns boolean language sql stable as $$ select s.done_n > 0 and (s.finished or s.ends_at < now()) $$;

-- ---------- o'yin ----------
create or replace function public.liga_px_start(p_id uuid, p_token text, p_kind text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.liga_px_sess; secs int := public.liga_px_cfg('px_secs', '60')::int; g text; v_lang text; q jsonb;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_kind not in ('pv', 'acc', 'side') then raise exception 'bad_input'; end if;
  if public.liga_px_cfg('px_on', 'on') <> 'on' then raise exception 'px_off'; end if;
  if (select count(*) from public.liga_px_sess where player_id = p_id and started_at > now() - interval '1 minute') >= 6 then raise exception 'too_many'; end if;
  update public.liga_px_sess set finished = true where player_id = p_id and not finished;
  select coalesce(sp.group_code, 'ASOSIY'), coalesce(sp.lang, 'uz') into g, v_lang from public.safari_players sp where sp.id = p_id;
  q := public.liga_px_q(p_kind, '{}');
  insert into public.liga_px_sess(player_id, group_code, kind, ends_at, day, mon, cur, q_at, seen)
  values (p_id, g, p_kind, now() + make_interval(secs => secs), public.liga_today(), public.liga_px_mon(), q, now(), array[q->>'id'])
  returning * into s;
  return jsonb_build_object('sid', s.id, 'kind', s.kind, 'secs', secs, 'left_ms', secs * 1000, 'k', 0, 'score', 0, 'right_n', 0, 'done_n', 0, 'combo', 0,
                            'q', public.liga_px_pub(q, v_lang));
end $$;

create or replace function public.liga_px_answer(p_id uuid, p_token text, p_sid uuid, p_k int, p_ans jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.liga_px_sess; ok boolean; fast boolean; pts int := 0; q jsonb; v_lang text; ans jsonb; e text; left_ms int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into s from public.liga_px_sess where id = p_sid and player_id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select coalesce(sp.lang, 'uz') into v_lang from public.safari_players sp where sp.id = p_id;
  left_ms := greatest(0, (extract(epoch from s.ends_at - now()) * 1000)::int);
  -- ikki marta bosilgan yoki eski javob — holatni qaytaramiz
  if s.finished or p_k <> s.done_n or s.cur is null or now() > s.ends_at + interval '2 seconds' then
    if not s.finished and now() > s.ends_at + interval '2 seconds' then update public.liga_px_sess set finished = true, cur = null where id = s.id; end if;
    return jsonb_build_object('stale', true, 'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo,
                              'left_ms', left_ms, 'over', s.finished or now() > s.ends_at, 'q', case when s.finished or now() > s.ends_at then null else public.liga_px_pub(s.cur, v_lang) end);
  end if;
  fast := now() - s.q_at < interval '350 milliseconds';
  if s.cur->>'t' = 'pv' then
    ok := coalesce(p_ans->>'dt', '') = s.cur->>'dt' and coalesce(p_ans->>'kt', '') = s.cur->>'kt';
    ans := jsonb_build_object('dt', s.cur->'dt', 'kt', s.cur->'kt');
    select case when v_lang = 'ru' then e_ru else e_uz end into e from public.liga_px_bank where id = (s.cur->>'bid')::int;
  else
    ok := (p_ans->>'pick') is not null and (p_ans->>'pick') ~ '^\d+$' and (p_ans->>'pick')::int = (s.cur->>'a')::int;
    ans := jsonb_build_object('a', s.cur->'a', 'code', s.cur->'code');
  end if;
  if fast then ok := false; end if;
  if ok then s.combo := s.combo + 1; pts := public.liga_px_pts(s.combo); else s.combo := 0; end if;
  s.score := s.score + pts; s.right_n := s.right_n + ok::int; s.done_n := s.done_n + 1; s.best_combo := greatest(s.best_combo, s.combo);
  q := case when now() < s.ends_at then public.liga_px_q(s.kind, s.seen) end;
  update public.liga_px_sess set score = s.score, right_n = s.right_n, done_n = s.done_n, combo = s.combo, best_combo = s.best_combo,
         cur = q, q_at = now(), seen = case when q is null then seen else seen || (q->>'id') end
   where id = s.id;
  return jsonb_build_object('ok', ok, 'why', case when fast then 'fast' else '' end, 'ans', ans, 'e', coalesce(e, ''), 'got', pts,
                            'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo,
                            'left_ms', left_ms, 'over', q is null, 'q', public.liga_px_pub(q, v_lang));
end $$;

-- kunlik vazifalar holati (o'yinchi, kun)
create or replace function public.liga_px_quests(p_id uuid, p_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select * from public.liga_px_sess x where x.player_id = p_id and x.day = p_day and public.liga_px_done(x)),
  v as (select (select count(*) from s)::int games, coalesce((select max(right_n) from s), 0) best_right,
               (select count(distinct kind) from s)::int kinds, coalesce((select max(best_combo) from s), 0) combo),
  q(id, pts, need, prog, ord) as (
    select 'play3', 30, 3, least(v.games, 3), 1 from v union all
    select 'right10', 40, 10, least(v.best_right, 10), 2 from v union all
    select 'all3', 50, 3, v.kinds, 3 from v union all
    select 'combo7', 30, 7, least(v.combo, 7), 4 from v)
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'pts', q.pts, 'need', q.need, 'prog', q.prog,
           'done', q.prog >= q.need, 'got', exists (select 1 from public.liga_px_quest z where z.player_id = p_id and z.day = p_day and z.quest = q.id)) order by q.ord), '[]')
    from q
$$;
-- bajarilgan vazifalarni yozish (ball oylik reytingga qo'shiladi); yangi berilganlarni qaytaradi
create or replace function public.liga_px_claim(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d date := public.liga_today(); x jsonb; got jsonb := '[]'; g text;
begin
  select coalesce(sp.group_code, 'ASOSIY') into g from public.safari_players sp where sp.id = p_id;
  for x in select * from jsonb_array_elements(public.liga_px_quests(p_id, d)) loop
    if (x->>'done')::boolean and not (x->>'got')::boolean then
      insert into public.liga_px_quest(player_id, day, quest, pts, mon, group_code)
      values (p_id, d, x->>'id', (x->>'pts')::int, public.liga_px_mon(d), g) on conflict do nothing;
      if found then got := got || jsonb_build_array(jsonb_build_object('id', x->>'id', 'pts', (x->>'pts')::int)); end if;
    end if;
  end loop;
  return got;
end $$;

-- oylik ball (o'yinlar + vazifalar)
create or replace function public.liga_px_month_pts(p_group text, p_mon text)
returns table(player_id uuid, pts bigint, games bigint)
language sql stable security definer set search_path = public as $$
  select player_id, sum(pts)::bigint, sum(games)::bigint from (
    select x.player_id, x.score pts, 1 games from public.liga_px_sess x where x.group_code = p_group and x.mon = p_mon and x.done_n > 0
    union all select q.player_id, q.pts, 0 from public.liga_px_quest q where q.group_code = p_group and q.mon = p_mon) z
  group by player_id
$$;
-- sovrin jamg'armasi
create or replace function public.liga_px_fund(p_group text, p_mon text)
returns bigint language sql stable security definer set search_path = public as $$
  select case when p_group <> 'ASOSIY' then 0 else
    public.liga_px_cfg('px_fund_base', '0')::bigint
    + public.liga_px_cfg('px_fund_per_pay', '0')::bigint * coalesce((
        select sum(greatest(coalesce(i.months, 1), 1)) from public.liga_invoices i
         where i.status = 'paid' and i.player_id is not null
           and to_char(coalesce(i.paid_at, i.created_at) at time zone 'Asia/Tashkent', 'YYYY-MM') = p_mon), 0) end
$$;
create or replace function public.liga_px_split()
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce((select array_agg(x::int) from unnest(string_to_array(public.liga_px_cfg('px_split', '50,30,20'), ',')) x where x ~ '^\d+$'), array[50,30,20])
$$;

create or replace function public.liga_px_finish(p_id uuid, p_token text, p_sid uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.liga_px_sess; got jsonb; best int; mp bigint; rk int; g text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  update public.liga_px_sess set finished = true, cur = null where id = p_sid and player_id = p_id returning * into s;
  if not found then raise exception 'not_found'; end if;
  got := public.liga_px_claim(p_id);
  select max(score) into best from public.liga_px_sess where player_id = p_id and kind = s.kind and id <> s.id;
  g := s.group_code;
  select m.pts into mp from public.liga_px_month_pts(g, s.mon) m where m.player_id = p_id;
  select count(*) + 1 into rk from public.liga_px_month_pts(g, s.mon) m where m.pts > coalesce(mp, 0);
  return jsonb_build_object('kind', s.kind, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'best_combo', s.best_combo,
                            'record', s.score > coalesce(best, 0) and s.score > 0, 'prev_best', coalesce(best, 0),
                            'quests_new', got, 'month_pts', coalesce(mp, 0), 'month_rank', rk);
end $$;

-- ---------- profil: bugun, oy, yutuqlar, vazifalar, jamg'arma ----------
create or replace function public.liga_px_me(p_id uuid, p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g text; v_mon text := public.liga_px_mon(); d date := public.liga_today(); tot record; mp bigint; rk int; n int; streak int := 0; dd date;
        ach jsonb; fund bigint; v_sp int[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select coalesce(sp.group_code, 'ASOSIY') into g from public.safari_players sp where sp.id = p_id;
  perform public.liga_px_claim(p_id);   -- app yopilib qolgan o'yinlardan bajarilgan vazifalar
  select count(*) filter (where public.liga_px_done(x)) games, coalesce(sum(right_n), 0) rights, coalesce(sum(done_n), 0) answers,
         coalesce(max(score) filter (where kind = 'pv'), 0) b_pv, coalesce(max(score) filter (where kind = 'acc'), 0) b_acc,
         coalesce(max(score) filter (where kind = 'side'), 0) b_side, coalesce(max(right_n), 0) max_right, coalesce(max(best_combo), 0) max_combo,
         count(*) filter (where public.liga_px_done(x) and right_n >= 10 and done_n = right_n) clean,
         count(*) filter (where public.liga_px_done(x) and day = d) today_games, coalesce(sum(score) filter (where day = d), 0) today_pts
    into tot from public.liga_px_sess x where x.player_id = p_id;
  select m.pts into mp from public.liga_px_month_pts(g, v_mon) m where m.player_id = p_id;
  select count(*) + 1 into rk from public.liga_px_month_pts(g, v_mon) m where m.pts > coalesce(mp, 0);
  select count(*) into n from public.liga_px_month_pts(g, v_mon);
  -- ketma-ket kunlar (bugun yoki kechadan boshlab)
  dd := case when exists (select 1 from public.liga_px_sess where player_id = p_id and day = d and done_n > 0) then d else d - 1 end;
  while exists (select 1 from public.liga_px_sess where player_id = p_id and day = dd and done_n > 0) and streak < 400 loop streak := streak + 1; dd := dd - 1; end loop;
  ach := jsonb_build_array(
    jsonb_build_object('id', 'first',  'prog', least(tot.games, 1),     'need', 1),
    jsonb_build_object('id', 'games10','prog', least(tot.games, 10),    'need', 10),
    jsonb_build_object('id', 'games50','prog', least(tot.games, 50),    'need', 50),
    jsonb_build_object('id', 'r100',   'prog', least(tot.rights, 100),  'need', 100),
    jsonb_build_object('id', 'r1000',  'prog', least(tot.rights, 1000), 'need', 1000),
    jsonb_build_object('id', 'sniper', 'prog', least(tot.max_right, 20),'need', 20),
    jsonb_build_object('id', 'clean',  'prog', least(tot.clean, 1),     'need', 1),
    jsonb_build_object('id', 'combo10','prog', least(tot.max_combo, 10),'need', 10),
    jsonb_build_object('id', 'streak3','prog', least(streak, 3),        'need', 3),
    jsonb_build_object('id', 'streak7','prog', least(streak, 7),        'need', 7),
    jsonb_build_object('id', 'master', 'prog', (tot.b_pv >= 150)::int + (tot.b_acc >= 150)::int + (tot.b_side >= 150)::int, 'need', 3),
    jsonb_build_object('id', 'top3',   'prog', case when coalesce(mp, 0) > 0 and rk <= 3 then 1 else 0 end, 'need', 1));
  fund := public.liga_px_fund(g, v_mon); v_sp := public.liga_px_split();
  return jsonb_build_object('mon', v_mon, 'secs', public.liga_px_cfg('px_secs', '60')::int, 'on', public.liga_px_cfg('px_on', 'on') = 'on',
    'today', jsonb_build_object('games', tot.today_games, 'pts', tot.today_pts + coalesce((select sum(z.pts) from public.liga_px_quest z where z.player_id = p_id and z.day = d), 0)),
    'month', jsonb_build_object('pts', coalesce(mp, 0), 'rank', case when coalesce(mp, 0) > 0 then rk end, 'n', n),
    'total', jsonb_build_object('games', tot.games, 'rights', tot.rights, 'answers', tot.answers, 'best', jsonb_build_object('pv', tot.b_pv, 'acc', tot.b_acc, 'side', tot.b_side)),
    'streak', streak, 'quests', public.liga_px_quests(p_id, d), 'ach', ach,
    'fund', jsonb_build_object('amount', fund, 'split', to_jsonb(v_sp), 'prizes', (select coalesce(jsonb_agg(fund * u.x / 100 order by u.o), '[]') from unnest(v_sp) with ordinality u(x, o))),
    'eligible', public.liga_player_ok(p_id));
end $$;

-- reyting: 'month' | 'week' | 'day' — o'z jamoasi ichida; top 50 + o'zi
create or replace function public.liga_px_board(p_id uuid, p_scope text default 'month')
returns table(pos int, name text, pts bigint, games bigint, me boolean, ok boolean)
language sql stable security definer set search_path = public as $$
  with g as (select coalesce(public.liga_my_group(p_id), 'ASOSIY') code),
  per as (select case p_scope when 'day' then public.liga_today()
                              when 'week' then public.liga_today() - (extract(isodow from public.liga_today())::int - 1)
                              else date_trunc('month', public.liga_today())::date end d0),
  agg as (
    select z.player_id, sum(z.pts)::bigint pts, sum(z.games)::bigint games from (
      select x.player_id, x.score pts, 1 games from public.liga_px_sess x, g, per where x.group_code = g.code and x.day >= per.d0 and x.done_n > 0
      union all select q.player_id, q.pts, 0 from public.liga_px_quest q, g, per where q.group_code = g.code and q.day >= per.d0) z
    group by z.player_id having sum(z.pts) > 0),
  r as (select a.*, (rank() over (order by a.pts desc))::int pos from agg a)
  select r.pos, public.liga_px_pname(r.player_id), r.pts, r.games, r.player_id = p_id, public.liga_player_ok(r.player_id)
    from r where r.pos <= 50 or r.player_id = p_id order by r.pos, r.games desc
$$;

-- o'tgan oylar g'oliblari (ochiq)
create or replace function public.liga_px_winners(p_id uuid default null)
returns table(mon text, pos int, name text, pts int, amount bigint, me boolean)
language sql stable security definer set search_path = public as $$
  select w.mon, w.pos, w.name, w.pts, w.amount, w.player_id = p_id from public.liga_px_win w
   where w.group_code = coalesce(public.liga_my_group(p_id), 'ASOSIY') order by w.mon desc, w.pos limit 12
$$;

-- oy yakuni: eng yaxshi 3 (obunasi faol) — sovrin. Har kuni 00:10 da (cron) tekshiradi, yopilmagan o'tgan oylarni yopadi.
create or replace function public.liga_px_close_month_sys(p_mon text default null)
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_mon text := coalesce(p_mon, to_char(date_trunc('month', public.liga_today()) - interval '1 day', 'YYYY-MM'));
        fund bigint; sp int[]; r record; i int := 0;
begin
  if v_mon >= public.liga_px_mon() then return 0; end if;           -- joriy oy yopilmaydi
  if exists (select 1 from public.liga_px_win w where w.mon = v_mon and w.group_code = 'ASOSIY') then return 0; end if;
  fund := public.liga_px_fund('ASOSIY', v_mon); sp := public.liga_px_split();
  for r in select m.player_id, m.pts from public.liga_px_month_pts('ASOSIY', v_mon) m
            where m.pts > 0 and public.liga_player_ok(m.player_id) order by m.pts desc, m.games asc limit coalesce(array_length(sp, 1), 3) loop
    i := i + 1;
    insert into public.liga_px_win(mon, group_code, pos, player_id, name, pts, amount)
    values (v_mon, 'ASOSIY', i, r.player_id, public.liga_px_pname(r.player_id), r.pts, fund * coalesce(sp[i], 0) / 100);
  end loop;
  return i;
end $$;

-- ---------- superadmin ----------
create or replace function public.liga_px_admin(p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mon text := public.liga_px_mon();
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'cfg', (select jsonb_object_agg(key, value) from public.liga_bot_config where key in ('px_secs','px_fund_base','px_fund_per_pay','px_split','px_on')),
    'mon', v_mon, 'fund', public.liga_px_fund('ASOSIY', v_mon),
    'players', (select count(distinct x.player_id) from public.liga_px_sess x where x.mon = v_mon and x.done_n > 0),
    'games', (select count(*) from public.liga_px_sess x where x.mon = v_mon and x.done_n > 0),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('name', public.liga_px_pname(m.player_id), 'pts', m.pts, 'ok', public.liga_player_ok(m.player_id)) order by m.pts desc), '[]')
              from (select * from public.liga_px_month_pts('ASOSIY', v_mon) order by pts desc limit 10) m),
    'wins', (select coalesce(jsonb_agg(jsonb_build_object('mon', w.mon, 'pos', w.pos, 'name', w.name, 'phone', s.phone, 'pts', w.pts, 'amount', w.amount, 'paid', w.paid) order by w.mon desc, w.pos), '[]')
               from public.liga_px_win w left join public.safari_players s on s.id = w.player_id));
end $$;
create or replace function public.liga_px_admin_set(p_pin text, p_key text, p_val text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  if p_key not in ('px_fund_base','px_fund_per_pay','px_split','px_on','px_secs') then raise exception 'bad_input'; end if;
  if p_key in ('px_fund_base','px_fund_per_pay') and coalesce(p_val, '') !~ '^\d{1,12}$' then raise exception 'bad_input'; end if;
  if p_key = 'px_secs' and (coalesce(p_val, '') !~ '^\d{2,3}$' or p_val::int not between 30 and 180) then raise exception 'bad_input'; end if;
  if p_key = 'px_split' and coalesce(p_val, '') !~ '^\d{1,3}(,\d{1,3}){0,9}$' then raise exception 'bad_input'; end if;
  if p_key = 'px_on' and p_val not in ('on','off') then raise exception 'bad_input'; end if;
  insert into public.liga_bot_config(key, value) values (p_key, p_val) on conflict (key) do update set value = excluded.value;
  return true;
end $$;
create or replace function public.liga_px_win_paid(p_pin text, p_mon text, p_pos int, p_paid boolean)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  update public.liga_px_win set paid = p_paid where mon = p_mon and group_code = 'ASOSIY' and pos = p_pos;
  return found;
end $$;

-- bot uchun: kunlik e'lon matni ma'lumoti (top-5 oylik, jamg'arma)
create or replace function public.liga_px_board_sys(p_group text default 'ASOSIY')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mon', public.liga_px_mon(), 'fund', public.liga_px_fund(p_group, public.liga_px_mon()), 'split', to_jsonb(public.liga_px_split()),
    'players', (select count(*) from public.liga_px_month_pts(p_group, public.liga_px_mon())),
    'today_games', (select count(*) from public.liga_px_sess x where x.group_code = p_group and x.day = public.liga_today() and x.done_n > 0),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('name', public.liga_px_pname(m.player_id), 'pts', m.pts) order by m.pts desc), '[]')
              from (select * from public.liga_px_month_pts(p_group, public.liga_px_mon()) where pts > 0 order by pts desc limit 5) m))
$$;

-- huquqlar: o'yinchi funksiyalari ochiq (token tekshiriladi), ichki va _sys — yopiq
revoke all on function public.liga_px_q(text, text[]), public.liga_px_claim(uuid), public.liga_px_close_month_sys(text),
  public.liga_px_board_sys(text), public.liga_px_month_pts(text, text), public.liga_px_quests(uuid, date), public.liga_px_pub(jsonb, text),
  public.liga_px_cfg(text, text), public.liga_px_pname(uuid), public.liga_px_fund(text, text), public.liga_px_split() from public, anon, authenticated;
grant execute on function public.liga_px_close_month_sys(text), public.liga_px_board_sys(text) to service_role;
grant execute on function public.liga_px_start(uuid, text, text), public.liga_px_answer(uuid, text, uuid, int, jsonb), public.liga_px_finish(uuid, text, uuid),
  public.liga_px_me(uuid, text), public.liga_px_board(uuid, text), public.liga_px_winners(uuid),
  public.liga_px_admin(text), public.liga_px_admin_set(text, text, text), public.liga_px_win_paid(text, text, int, boolean) to anon, authenticated;

do $$ begin
  perform cron.unschedule('liga-mashq-oy') where exists (select 1 from cron.job where jobname = 'liga-mashq-oy');
  perform cron.schedule('liga-mashq-oy', '10 19 * * *', $c$select public.liga_px_close_month_sys()$c$);   -- 00:10 Toshkent
end $$;
