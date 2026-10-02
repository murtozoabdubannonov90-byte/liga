-- Hisobchi Liga 2.0: til, liga darajalari, taklif, duel, jonli final, savol muharriri, xodim testi, QR sertifikat, Telegram bog'lanish
-- (faqat qo'shimcha; hech narsa o'chirilmaydi)

alter table public.safari_players add column if not exists tier int not null default 0;          -- 0 Bronza, 1 Kumush, 2 Oltin, 3 Olmos
alter table public.safari_players add column if not exists lang text;
alter table public.safari_players add column if not exists tg_user_id bigint;
alter table public.safari_players add column if not exists ref_code text;
alter table public.safari_players add column if not exists referred_by uuid references public.safari_players(id) on delete set null;
alter table public.safari_players add column if not exists ref_rewarded boolean not null default false;
create unique index if not exists safari_players_ref_code on public.safari_players(ref_code) where ref_code is not null;

create or replace function public.liga_short_code(n int default 6) returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(extensions.gen_random_bytes(1),0) % 32), 1), '')
  from generate_series(1, n)
$$;
create or replace function public.liga_ensure_ref(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  select ref_code into c from public.safari_players where id = p_id;
  if c is not null then return c; end if;
  loop
    c := public.liga_short_code(6);
    exit when not exists (select 1 from public.safari_players where ref_code = c);
  end loop;
  update public.safari_players set ref_code = c where id = p_id;
  return c;
end $$;

-- ro'yxatdan o'tish: taklif kodi va til bilan
create or replace function public.liga_join3(p_first text, p_last text, p_phone text, p_group text default 'ASOSIY', p_region text default null, p_ref text default null, p_lang text default null)
returns table(id uuid, token text, ref_code text)
language plpgsql security definer set search_path = public as $$
declare r record; rb uuid;
begin
  select * into r from public.liga_join2(p_first, p_last, p_phone, p_group, p_region);
  if p_ref is not null then
    select s.id into rb from public.safari_players s where s.ref_code = upper(trim(p_ref)) and s.id <> r.id;
    if rb is not null then update public.safari_players s set referred_by = rb where s.id = r.id and s.referred_by is null and s.ref_rewarded = false; end if;
  end if;
  if p_lang in ('uz','uzc','ru') then update public.safari_players s set lang = p_lang where s.id = r.id; end if;
  return query select r.id, r.token, public.liga_ensure_ref(r.id);
end $$;

create or replace function public.liga_set_lang(p_id uuid, p_token text, p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_lang in ('uz','uzc','ru') then update public.safari_players set lang = p_lang where id = p_id; end if;
end $$;

-- taklif mukofoti: taklif qilingan odamning birinchi tasdiqlangan to'lovida taklif qilganga +7 kun
create or replace function public.liga_ref_reward(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare rb uuid;
begin
  select referred_by into rb from public.safari_players where id = p_player and ref_rewarded = false;
  if rb is null then return; end if;
  update public.safari_players set ref_rewarded = true where id = p_player;
  update public.safari_players set paid_until =
    greatest(coalesce(public.liga_eff_until(paid_until, created_at), public.liga_today() - 1), public.liga_today() - 1) + 7
  where id = rb;
end $$;

-- to'lov tasdiqlanadigan joylarda taklif mukofoti
create or replace function public.liga_admin_receipt_decide(p_pin text, p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare inv record; g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  select i.* into inv from public.liga_invoices i join public.safari_players s on s.id = i.player_id
    where i.id = p_id and s.group_code = g and i.status = 'check' for update of i;
  if inv is null then return; end if;
  if p_ok then
    update public.liga_invoices set status = 'paid' where id = p_id;
    perform public.liga_ref_reward(inv.player_id);
  else
    update public.liga_invoices set status = 'cancelled', note = 'chek rad etildi' where id = p_id;
    update public.safari_players set paid_until = inv.prev_until where id = inv.player_id;
  end if;
end $$;

create or replace function public.liga_receipt_decide_sys(p_id bigint, p_ok boolean, p_admin_chat bigint)
returns table(done boolean, status text, player_chat bigint, name text)
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.* into inv from public.liga_invoices i where i.id = p_id for update;
  if inv is null or not exists (select 1 from public.liga_admin_chats a where a.chat_id = p_admin_chat and a.group_code = inv.group_code) then
    return query select false, null::text, null::bigint, null::text; return;
  end if;
  if inv.status = 'check' then
    if p_ok then update public.liga_invoices set status = 'paid' where liga_invoices.id = p_id;
         perform public.liga_ref_reward(inv.player_id);
    else update public.liga_invoices set status = 'cancelled', note = 'chek rad etildi' where liga_invoices.id = p_id;
         update public.safari_players set paid_until = inv.prev_until where safari_players.id = inv.player_id; end if;
  end if;
  return query select true, (select i.status from public.liga_invoices i where i.id = p_id),
    coalesce(inv.tg_chat_id, (select s.tg_user_id from public.safari_players s where s.id = inv.player_id)),
    (select trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')) from public.safari_players s where s.id = inv.player_id);
end $$;

create or replace function public.liga_admin_player_pay(p_pin text, p_id uuid, p_months int) returns date
language plpgsql security definer set search_path = public as $$
declare g text; s record; m int := greatest(1, least(coalesce(p_months,1), 12)); nu date; pr int;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return null; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  select * into s from public.safari_players where id = p_id and group_code = g;
  if s is null then return null; end if;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_id, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, prev_until, paid_at, note)
    values (g, 1, m, pr::bigint * m, 'paid', 'qo''lda', p_id, s.paid_until, now(), 'admin qo''shdi');
  perform public.liga_ref_reward(p_id);
  return nu;
end $$;

create or replace function public.liga_invoice_paid(p_invoice bigint, p_provider text, p_tx text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.liga_invoices where id = p_invoice for update;
  if inv is null or inv.status <> 'new' then return false; end if;
  update public.liga_invoices set status = 'paid', provider = p_provider, provider_tx = p_tx, paid_at = now() where id = p_invoice;
  if inv.player_id is not null then perform public.liga_player_extend(inv.player_id, inv.months); perform public.liga_ref_reward(inv.player_id);
  else perform public.liga_extend(inv.group_code, 30 * inv.months); end if;
  return true;
end $$;

-- o'yinchi holati (obuna, daraja, taklif)
create or replace function public.liga_player_status2(p_id uuid)
returns table(paid_until date, ok boolean, personal boolean, price int, pending boolean, tier int, ref_code text, refs int, tg_linked boolean, lang text)
language sql security definer set search_path = public as $$
  select public.liga_eff_until(s.paid_until, s.created_at), public.liga_player_ok(s.id), s.group_code = 'ASOSIY',
         (select value::int from public.liga_bot_config where key = 'price_per_member'),
         exists (select 1 from public.liga_invoices i where i.player_id = s.id and i.status = 'check'),
         s.tier, public.liga_ensure_ref(s.id),
         (select count(*)::int from public.safari_players r where r.referred_by = s.id),
         s.tg_user_id is not null, s.lang
  from public.safari_players s where s.id = p_id
$$;

create or replace function public.liga_members2(p_id uuid default null)
returns table(name text, is_me boolean, medal int, tier int)
language sql stable security definer set search_path = public as $$
  with g as (select public.liga_my_group(p_id) code),
  last as (select r.player_id, row_number() over (order by r.week_xp desc) pos
           from public.liga_week_results r, g where r.group_code = g.code and r.week_id = public.liga_last_week_id() and r.week_xp > 0)
  select trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.'), s.id = p_id,
         (select case when l.pos <= 3 then l.pos::int end from last l where l.player_id = s.id), s.tier
  from public.safari_players s, g where s.group_code = g.code order by s.created_at
$$;

-- ---------- liga darajalari: juma 12:10 da (o'tgan hafta natijasi bo'yicha) ----------
create table if not exists public.liga_tier_log(week_id text not null, player_id uuid not null references public.safari_players(id) on delete cascade,
  before int not null, after int not null, week_xp int not null, primary key (week_id, player_id));
alter table public.liga_tier_log enable row level security;
revoke all on public.liga_tier_log from anon, authenticated;

create or replace function public.liga_tiers_run() returns int
language plpgsql security definer set search_path = public as $$
declare w text := public.liga_last_week_id(); n int := 0; r record; nt int;
begin
  for r in
    with x as (
      select s.id, s.tier, s.group_code,
        coalesce((select wr.week_xp from public.liga_week_results wr where wr.player_id = s.id and wr.week_id = w),
                 case when s.week_id = w then s.week_xp end, 0) xp
      from public.safari_players s
      where not exists (select 1 from public.liga_tier_log l where l.week_id = w and l.player_id = s.id)
        and s.created_at < (to_timestamp(w, 'YYYY-MM-DD"T"HH24:MI') at time zone 'UTC')
    )
    select x.*, rank() over (partition by x.group_code order by x.xp desc) rnk from x
  loop
    nt := r.tier;
    if r.xp >= 1600 or (r.rnk <= 3 and r.xp > 0) then nt := least(3, r.tier + 1);
    elsif r.xp < 400 then nt := greatest(0, r.tier - 1); end if;
    insert into public.liga_tier_log(week_id, player_id, before, after, week_xp) values (w, r.id, r.tier, nt, r.xp);
    if nt <> r.tier then update public.safari_players set tier = nt where id = r.id; end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- duel (1 ga 1) ----------
create table if not exists public.liga_duels(
  code text primary key, a_id uuid not null references public.safari_players(id) on delete cascade,
  b_id uuid references public.safari_players(id) on delete cascade,
  a_score int, a_ms int, b_score int, b_ms int, lang text, created_at timestamptz not null default now());
alter table public.liga_duels enable row level security;
revoke all on public.liga_duels from anon, authenticated;

create or replace function public.liga_duel_create(p_id uuid, p_token text, p_lang text default 'uz') returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if (select count(*) from public.liga_duels where a_id = p_id and created_at > now() - interval '1 day') >= 20 then raise exception 'too_many'; end if;
  loop c := public.liga_short_code(6); exit when not exists (select 1 from public.liga_duels where code = c); end loop;
  insert into public.liga_duels(code, a_id, lang) values (c, p_id, coalesce(p_lang,'uz'));
  return c;
end $$;

create or replace function public.liga_duel_get(p_code text, p_id uuid default null)
returns table(code text, a_name text, b_name text, a_score int, a_ms int, b_score int, b_ms int, is_a boolean, is_b boolean, lang text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.code,
    (select trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.') from public.safari_players s where s.id = d.a_id),
    (select trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.') from public.safari_players s where s.id = d.b_id),
    d.a_score, d.a_ms, d.b_score, d.b_ms, d.a_id = p_id, d.b_id = p_id, d.lang, d.created_at
  from public.liga_duels d where d.code = upper(trim(p_code))
$$;

create or replace function public.liga_duel_submit(p_code text, p_id uuid, p_token text, p_score int, p_ms int)
returns table(side text, a_tg bigint, b_tg bigint)
language plpgsql security definer set search_path = public as $$
declare d record; sc int := greatest(0, least(coalesce(p_score,0), 10)); ms int := greatest(0, coalesce(p_ms,0));
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_duels where code = upper(trim(p_code)) for update;
  if d is null then raise exception 'not_found'; end if;
  if d.a_id = p_id then
    if d.a_score is not null then raise exception 'already_done'; end if;
    update public.liga_duels set a_score = sc, a_ms = ms where code = d.code;
    return query select 'a'::text, null::bigint, (select tg_user_id from public.safari_players where id = d.b_id); return;
  end if;
  if d.b_id is not null and d.b_id <> p_id then raise exception 'duel_taken'; end if;
  if d.b_score is not null then raise exception 'already_done'; end if;
  if d.created_at < now() - interval '7 days' then raise exception 'duel_expired'; end if;
  update public.liga_duels set b_id = p_id, b_score = sc, b_ms = ms where code = d.code;
  return query select 'b'::text, (select tg_user_id from public.safari_players where id = d.a_id), null::bigint;
end $$;

create or replace function public.liga_my_duels(p_id uuid)
returns table(code text, a_name text, b_name text, a_score int, a_ms int, b_score int, b_ms int, is_a boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.code,
    (select trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.') from public.safari_players s where s.id = d.a_id),
    (select trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.') from public.safari_players s where s.id = d.b_id),
    d.a_score, d.a_ms, d.b_score, d.b_ms, d.a_id = p_id, d.created_at
  from public.liga_duels d where d.a_id = p_id or d.b_id = p_id order by d.created_at desc limit 15
$$;

-- ---------- jonli final ----------
create table if not exists public.liga_final_live(month text not null, player_id uuid not null references public.safari_players(id) on delete cascade,
  group_code text not null, right_n int not null default 0, done_n int not null default 0, updated_at timestamptz not null default now(),
  primary key (month, player_id));
alter table public.liga_final_live enable row level security;
revoke all on public.liga_final_live from anon, authenticated;

create or replace function public.liga_final_tick(p_id uuid, p_token text, p_right int, p_done int) returns void
language plpgsql security definer set search_path = public as $$
declare mm text := public.liga_month_now(); g text; nowt timestamp := now() at time zone 'Asia/Tashkent';
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if nowt::date <> public.liga_final_date(mm) or nowt::time not between time '10:00' and time '13:05' then return; end if;
  g := public.liga_my_group(p_id);
  if not exists (select 1 from public.liga_final_qualifiers(g, mm) q where q.player_id = p_id) then return; end if;
  insert into public.liga_final_live(month, player_id, group_code, right_n, done_n) values (mm, p_id, g, greatest(0,least(p_right,20)), greatest(0,least(p_done,20)))
  on conflict (month, player_id) do update set right_n = greatest(public.liga_final_live.right_n, excluded.right_n),
    done_n = greatest(public.liga_final_live.done_n, excluded.done_n), updated_at = now();
end $$;

create or replace function public.liga_final_board(p_id uuid)
returns table(name text, right_n int, done_n int, finished boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select q.name, coalesce(l.right_n, 0), coalesce(l.done_n, 0),
    exists (select 1 from public.liga_finals f where f.month = public.liga_month_now() and f.player_id = q.player_id), q.player_id = p_id
  from public.liga_final_qualifiers(public.liga_my_group(p_id), public.liga_month_now()) q
  left join public.liga_final_live l on l.month = public.liga_month_now() and l.player_id = q.player_id
  order by coalesce(l.right_n,0) desc, coalesce(l.done_n,0) asc
$$;

-- ---------- savol muharriri ----------
create table if not exists public.liga_custom_q(
  id bigserial primary key, group_code text references public.liga_groups(code) on update cascade,   -- null = hamma jamoalar uchun (superadmin)
  t text not null check (t in ('mc','pv','calc')), q text not null, o jsonb, a numeric, dt text, kt text, e text not null default '',
  unit text, lang text not null default 'uz', active boolean not null default true, created_at timestamptz not null default now());
alter table public.liga_custom_q enable row level security;
revoke all on public.liga_custom_q from anon, authenticated;

create or replace function public.liga_cq_list(p_id uuid)
returns table(id bigint, t text, q text, o jsonb, a numeric, dt text, kt text, e text, unit text, lang text, global boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.t, c.q, c.o, c.a, c.dt, c.kt, c.e, c.unit, c.lang, c.group_code is null
  from public.liga_custom_q c where c.active and (c.group_code is null or c.group_code = public.liga_my_group(p_id))
  order by c.id
$$;

create or replace function public.liga_cq_admin(p_pin text)
returns table(id bigint, t text, q text, o jsonb, a numeric, dt text, kt text, e text, unit text, lang text, global boolean, active boolean)
language plpgsql security definer set search_path = public as $$
declare role text := public.liga_pin_role(p_pin); g text;
begin
  if role is null then return; end if;
  if role = 'admin' then select code into g from public.liga_groups where admin_pin = p_pin; end if;
  return query select c.id, c.t, c.q, c.o, c.a, c.dt, c.kt, c.e, c.unit, c.lang, c.group_code is null, c.active
    from public.liga_custom_q c where (role = 'super' and c.group_code is null) or (role = 'admin' and c.group_code = g)
    order by c.id desc limit 300;
end $$;

create or replace function public.liga_cq_save(p_pin text, p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare role text := public.liga_pin_role(p_pin); g text; nid bigint; tt text := p->>'t';
begin
  if role is null then raise exception 'not_admin'; end if;
  if role = 'admin' then select code into g from public.liga_groups where admin_pin = p_pin; end if;
  if tt not in ('mc','pv','calc') or length(trim(coalesce(p->>'q',''))) < 8 then raise exception 'bad_input'; end if;
  if tt = 'mc' and (jsonb_typeof(p->'o') <> 'array' or jsonb_array_length(p->'o') not between 2 and 5
     or (p->>'a')::int < 0 or (p->>'a')::int >= jsonb_array_length(p->'o')) then raise exception 'bad_input'; end if;
  if tt = 'pv' and ((p->>'dt') !~ '^\d{4}$' or (p->>'kt') !~ '^\d{4}$') then raise exception 'bad_input'; end if;
  if tt = 'calc' and (p->>'a') is null then raise exception 'bad_input'; end if;
  if p_id is null then
    insert into public.liga_custom_q(group_code, t, q, o, a, dt, kt, e, unit, lang)
    values (g, tt, left(trim(p->>'q'),500), p->'o', (p->>'a')::numeric, p->>'dt', p->>'kt', left(coalesce(p->>'e',''),500), p->>'unit', coalesce(p->>'lang','uz'))
    returning id into nid;
  else
    update public.liga_custom_q set t = tt, q = left(trim(p->>'q'),500), o = p->'o', a = (p->>'a')::numeric, dt = p->>'dt', kt = p->>'kt',
      e = left(coalesce(p->>'e',''),500), unit = p->>'unit', lang = coalesce(p->>'lang','uz'), active = coalesce((p->>'active')::boolean, true)
    where id = p_id and ((role = 'super' and group_code is null) or (role = 'admin' and group_code = g)) returning id into nid;
  end if;
  return nid;
end $$;

-- ---------- xodim tanlash testi ----------
create table if not exists public.liga_tests(code text primary key, group_code text not null references public.liga_groups(code) on update cascade,
  title text not null, n int not null default 30, minutes int not null default 30, lang text not null default 'uz', active boolean not null default true,
  created_at timestamptz not null default now());
create table if not exists public.liga_test_runs(id uuid primary key default gen_random_uuid(), code text not null references public.liga_tests(code) on delete cascade,
  cand_name text not null, cand_phone text not null, started_at timestamptz not null default now(), finished_at timestamptz,
  score int, total int, ms int, late boolean not null default false, detail jsonb, unique (code, cand_phone));
alter table public.liga_tests enable row level security;
alter table public.liga_test_runs enable row level security;
revoke all on public.liga_tests, public.liga_test_runs from anon, authenticated;

create or replace function public.liga_test_create(p_pin text, p_title text, p_n int, p_minutes int, p_lang text default 'uz') returns text
language plpgsql security definer set search_path = public as $$
declare g text; c text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then raise exception 'not_admin'; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  loop c := public.liga_short_code(7); exit when not exists (select 1 from public.liga_tests where code = c); end loop;
  insert into public.liga_tests(code, group_code, title, n, minutes, lang)
    values (c, g, left(coalesce(nullif(trim(p_title),''),'Buxgalter testi'),80), greatest(10,least(coalesce(p_n,30),60)), greatest(5,least(coalesce(p_minutes,30),120)), coalesce(p_lang,'uz'));
  return c;
end $$;

create or replace function public.liga_test_admin(p_pin text)
returns table(code text, title text, n int, minutes int, lang text, active boolean, created_at timestamptz, runs jsonb)
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select lg.code into g from public.liga_groups lg where lg.admin_pin = p_pin;
  return query select t.code, t.title, t.n, t.minutes, t.lang, t.active, t.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('name', r.cand_name, 'phone', r.cand_phone, 'score', r.score, 'total', r.total, 'ms', r.ms,
       'late', r.late, 'started', r.started_at, 'finished', r.finished_at, 'detail', r.detail) order by r.score desc nulls last, r.ms)
       from public.liga_test_runs r where r.code = t.code), '[]'::jsonb)
  from public.liga_tests t where t.group_code = g order by t.created_at desc;
end $$;

create or replace function public.liga_test_toggle(p_pin text, p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  update public.liga_tests set active = p_active where code = p_code and group_code = (select code from public.liga_groups where admin_pin = p_pin);
end $$;

create or replace function public.liga_test_open(p_code text)
returns table(code text, title text, n int, minutes int, lang text, active boolean, company text)
language sql stable security definer set search_path = public as $$
  select t.code, t.title, t.n, t.minutes, t.lang, t.active, g.name from public.liga_tests t join public.liga_groups g on g.code = t.group_code
  where t.code = upper(trim(p_code))
$$;

create or replace function public.liga_test_start(p_code text, p_name text, p_phone text)
returns table(run_id uuid, started_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare t record; r record;
begin
  select * into t from public.liga_tests where code = upper(trim(p_code));
  if t is null or not t.active then raise exception 'test_closed'; end if;
  if length(trim(coalesce(p_name,''))) < 3 or coalesce(p_phone,'') !~ '^\+998\d{9}$' then raise exception 'bad_input'; end if;
  select * into r from public.liga_test_runs x where x.code = t.code and x.cand_phone = p_phone;
  if r is not null then
    if r.finished_at is not null then raise exception 'already_done'; end if;
    return query select r.id, r.started_at; return;
  end if;
  insert into public.liga_test_runs(code, cand_name, cand_phone) values (t.code, left(trim(p_name),80), p_phone) returning * into r;
  return query select r.id, r.started_at;
end $$;

create or replace function public.liga_test_finish(p_run uuid, p_score int, p_total int, p_ms int, p_detail jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r record; t record;
begin
  select * into r from public.liga_test_runs where id = p_run for update;
  if r is null or r.finished_at is not null then return; end if;
  select * into t from public.liga_tests where code = r.code;
  update public.liga_test_runs set finished_at = now(), score = greatest(0, least(p_score, t.n)), total = t.n, ms = greatest(0, p_ms),
    late = now() > r.started_at + make_interval(mins => t.minutes + 2), detail = p_detail where id = p_run;
end $$;

-- ---------- QR sertifikatlar ----------
create table if not exists public.liga_certs(id text primary key, player_id uuid not null references public.safari_players(id) on delete cascade,
  kind text not null, ref text not null default '', title text not null, detail text, issued_at timestamptz not null default now(), unique (player_id, kind, ref));
alter table public.liga_certs enable row level security;
revoke all on public.liga_certs from anon, authenticated;

create or replace function public.liga_cert_issue(p_id uuid, p_token text, p_kind text)
returns table(id text, title text, detail text, issued_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare w text := public.liga_last_week_id(); v_pos int; v_xp int; v_ref text := ''; tt text; dd text; c text; s record;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into s from public.safari_players where safari_players.id = p_id;
  if p_kind = 'week' then
    select x.pos, x.week_xp into v_pos, v_xp from (
      select r.player_id, r.week_xp, row_number() over (order by r.week_xp desc) pos from public.liga_week_results r
      where r.week_id = w and r.group_code = s.group_code and r.week_xp > 0) x where x.player_id = p_id;
    if v_pos is null or v_pos > 3 then raise exception 'not_eligible'; end if;
    v_ref := w; tt := 'week'; dd := v_pos || '|' || v_xp || '|' || w;
  elsif p_kind = 'all12' then
    if coalesce(s.stages,0) < 12 then raise exception 'not_eligible'; end if;
    tt := 'all12'; dd := coalesce(s.xp,0)::text;
  else raise exception 'bad_input'; end if;
  select x.id into c from public.liga_certs x where x.player_id = p_id and x.kind = p_kind and x.ref = v_ref;
  if c is null then
    loop c := public.liga_short_code(8); exit when not exists (select 1 from public.liga_certs x where x.id = c); end loop;
    insert into public.liga_certs(id, player_id, kind, ref, title, detail) values (c, p_id, p_kind, v_ref, tt, dd);
  end if;
  return query select x.id, x.title, x.detail, x.issued_at from public.liga_certs x where x.id = c;
end $$;

create or replace function public.liga_cert_verify(p_id text)
returns table(id text, name text, kind text, title text, detail text, issued_at timestamptz, team text)
language sql stable security definer set search_path = public as $$
  select c.id, trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')), c.kind, c.title, c.detail, c.issued_at,
    (select g.name from public.liga_groups g where g.code = s.group_code)
  from public.liga_certs c join public.safari_players s on s.id = c.player_id where c.id = upper(trim(p_id))
$$;

create or replace function public.liga_my_certs(p_id uuid)
returns table(id text, kind text, title text, detail text, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.title, c.detail, c.issued_at from public.liga_certs c where c.player_id = p_id order by c.issued_at desc
$$;

-- ---------- Telegram: shaxsiy eslatma uchun bog'lanish (bot initData ni tekshirgach chaqiradi) ----------
create or replace function public.liga_tg_link_sys(p_id uuid, p_token text, p_tg bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then return false; end if;
  update public.safari_players set tg_user_id = null where tg_user_id = p_tg and id <> p_id;
  update public.safari_players set tg_user_id = p_tg where id = p_id;
  return true;
end $$;

-- bugungi bosqichni bajarmaganlar (bot 16:00 da shaxsan eslatadi)
create or replace function public.liga_remind_list()
returns table(tg bigint, first_name text, lang text, stage int)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, coalesce(s.lang,'uz'), public.liga_stage_index(g.start_date, public.liga_today())
  from public.safari_players s join public.liga_groups g on g.code = s.group_code
  where s.tg_user_id is not null and g.active and public.liga_player_ok(s.id)
    and public.liga_stage_index(g.start_date, public.liga_today()) is not null
    and not (s.week_id = public.liga_cur_week_id() and s.week_stages ? (public.liga_stage_index(g.start_date, public.liga_today()))::text)
$$;

-- huquqlar
revoke all on function public.liga_short_code(int), public.liga_ensure_ref(uuid), public.liga_ref_reward(uuid), public.liga_tiers_run(),
  public.liga_tg_link_sys(uuid,text,bigint), public.liga_remind_list() from public, anon, authenticated;
grant execute on function public.liga_short_code(int), public.liga_ensure_ref(uuid), public.liga_ref_reward(uuid), public.liga_tiers_run(),
  public.liga_tg_link_sys(uuid,text,bigint), public.liga_remind_list() to service_role;
revoke all on function public.liga_join3(text,text,text,text,text,text,text), public.liga_set_lang(uuid,text,text), public.liga_player_status2(uuid),
  public.liga_members2(uuid), public.liga_duel_create(uuid,text,text), public.liga_duel_get(text,uuid), public.liga_duel_submit(text,uuid,text,int,int),
  public.liga_my_duels(uuid), public.liga_final_tick(uuid,text,int,int), public.liga_final_board(uuid), public.liga_cq_list(uuid), public.liga_cq_admin(text),
  public.liga_cq_save(text,bigint,jsonb), public.liga_test_create(text,text,int,int,text), public.liga_test_admin(text), public.liga_test_toggle(text,text,boolean),
  public.liga_test_open(text), public.liga_test_start(text,text,text), public.liga_test_finish(uuid,int,int,int,jsonb), public.liga_cert_issue(uuid,text,text),
  public.liga_cert_verify(text), public.liga_my_certs(uuid) from public;
grant execute on function public.liga_join3(text,text,text,text,text,text,text), public.liga_set_lang(uuid,text,text), public.liga_player_status2(uuid),
  public.liga_members2(uuid), public.liga_duel_create(uuid,text,text), public.liga_duel_get(text,uuid), public.liga_duel_submit(text,uuid,text,int,int),
  public.liga_my_duels(uuid), public.liga_final_tick(uuid,text,int,int), public.liga_final_board(uuid), public.liga_cq_list(uuid), public.liga_cq_admin(text),
  public.liga_cq_save(text,bigint,jsonb), public.liga_test_create(text,text,int,int,text), public.liga_test_admin(text), public.liga_test_toggle(text,text,boolean),
  public.liga_test_open(text), public.liga_test_start(text,text,text), public.liga_test_finish(uuid,int,int,int,jsonb), public.liga_cert_issue(uuid,text,text),
  public.liga_cert_verify(text), public.liga_my_certs(uuid) to anon, authenticated, service_role;

-- jadval: darajalar juma 12:10 (Toshkent) = 07:10 UTC
select cron.schedule('liga-darajalar', '10 7 * * 5', 'select public.liga_tiers_run()');
