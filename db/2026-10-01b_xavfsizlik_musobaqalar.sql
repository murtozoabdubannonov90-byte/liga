-- Hisobchi Liga — xavfsizlik, viloyat, haftaning savoli, oylik final, viloyat ligasi, oylik hisobot, to'lovlar
-- ============================================================================================

-- ---------- 1. Ustunlar ----------
alter table public.safari_players add column if not exists token_hash text;
alter table public.safari_players add column if not exists region text;
alter table public.safari_players add column if not exists acc_ok int not null default 0;
alter table public.safari_players add column if not exists acc_total int not null default 0;
alter table public.liga_groups add column if not exists region text;

insert into public.liga_bot_config(key, value) values ('price_per_member', '30000') on conflict (key) do nothing;

-- viloyatlar ro'yxati (tekshirish uchun)
create or replace function public.liga_regions() returns text[] language sql immutable as $$
  select array['Qoraqalpog''iston Respublikasi','Andijon viloyati','Buxoro viloyati','Farg''ona viloyati','Jizzax viloyati',
    'Xorazm viloyati','Namangan viloyati','Navoiy viloyati','Qashqadaryo viloyati','Samarqand viloyati','Sirdaryo viloyati',
    'Surxondaryo viloyati','Toshkent viloyati','Toshkent shahri']
$$;
create or replace function public.liga_region_ok(r text) returns text language sql immutable as $$
  select case when r = any(public.liga_regions()) then r end
$$;

-- ---------- 2. Vaqt yordamchilari ----------
-- joriy liga haftasining tugash vaqti (juma 12:00 Toshkent = 07:00 UTC), ilovadagi weekId() bilan bir xil
create or replace function public.liga_cur_week_id() returns text language sql stable as $$
  select to_char(case when t <= (now() at time zone 'UTC') then t + interval '7 days' else t end, 'YYYY-MM-DD"T"HH24:MI')
  from (select date_trunc('week', now() at time zone 'UTC') + interval '4 days 7 hours' as t) x
$$;
create or replace function public.liga_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Tashkent')::date
$$;
-- sana uchun bosqich raqami (0..11): jamoa boshlanishidan beri ish kunlari soni mod 12
create or replace function public.liga_stage_index(p_start date, p_day date) returns int language sql immutable as $$
  select case when p_day < p_start or extract(isodow from p_day) > 5 then null
    else ((select count(*) from generate_series(p_start, p_day - 1, interval '1 day') d where extract(isodow from d) <= 5) % 12)::int end
$$;
-- joriy haftada ruxsat etilgan bosqichlar (o'tgan juma .. shu juma, bugungacha)
create or replace function public.liga_allowed_stages(p_group text) returns int[] language sql stable security definer set search_path = public as $$
  with g as (select start_date from public.liga_groups where code = p_group),
  w as (select (substr(public.liga_cur_week_id(),1,10))::date as fri)
  select coalesce(array_agg(distinct public.liga_stage_index(g.start_date, d::date)) filter (where public.liga_stage_index(g.start_date, d::date) is not null), '{}')
  from g, w, generate_series(w.fri - 7, least(w.fri, public.liga_today()), interval '1 day') d
$$;

-- ---------- 3. Mijoz IP va PIN himoyasi (10 daqiqada 15 ta xato → blok) ----------
create table if not exists public.liga_pin_fails(ip text not null, at timestamptz not null default now());
create index if not exists liga_pin_fails_idx on public.liga_pin_fails(ip, at);
alter table public.liga_pin_fails enable row level security;
revoke all on public.liga_pin_fails from anon, authenticated;

create or replace function public.liga_client_ip() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'cf-connecting-ip',
    split_part(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ',', 1),
    'local')
$$;

-- 'super' | 'admin' | null. Noto'g'ri PIN qayd etiladi (istisno bermaydi — qayd saqlanib qolsin)
create or replace function public.liga_pin_role(p_pin text) returns text
language plpgsql security definer set search_path = public as $$
declare v_ip text := public.liga_client_ip(); r text;
begin
  if (select count(*) from public.liga_pin_fails f where f.ip = v_ip and f.at > now() - interval '10 minutes') >= 15 then
    raise exception 'too_many';
  end if;
  if public.liga_is_super(p_pin) then r := 'super';
  elsif exists (select 1 from public.liga_groups where admin_pin = p_pin) then r := 'admin';
  end if;
  if r is null then
    insert into public.liga_pin_fails(ip) values (v_ip);
    delete from public.liga_pin_fails where at < now() - interval '1 day';
  end if;
  return r;
end $$;
create or replace function public.liga_pin_check(p_pin text) returns text language sql security definer set search_path = public as $$
  select coalesce(public.liga_pin_role(p_pin), 'bad')
$$;

-- ---------- 4. O'yinchi kaliti (token) ----------
create or replace function public.liga_hash(t text) returns text language sql immutable as $$
  select encode(extensions.digest(t, 'sha256'), 'hex')
$$;
create or replace function public.liga_new_token() returns text language sql volatile as $$
  select encode(extensions.gen_random_bytes(24), 'hex')
$$;
create or replace function public.liga_auth(p_id uuid, p_token text) returns boolean language sql stable security definer set search_path = public as $$
  select p_token is not null and exists (select 1 from public.safari_players where id = p_id and token_hash = public.liga_hash(p_token))
$$;

-- ro'yxatdan o'tish: kalit qaytaradi. Telefon band bo'lsa (boshqa qurilmada) — 'phone_taken' (admin qurilmani almashtiradi)
create or replace function public.liga_join2(p_first text, p_last text, p_phone text, p_group text default 'ASOSIY', p_region text default null)
returns table(id uuid, token text) language plpgsql security definer set search_path = public as $$
declare v uuid; h text; t text := public.liga_new_token(); g text := upper(coalesce(nullif(trim(p_group),''),'ASOSIY'));
begin
  if coalesce(trim(p_first),'') = '' or coalesce(p_phone,'') !~ '^\+998\d{9}$' then raise exception 'bad_input'; end if;
  select s.id, s.token_hash into v, h from public.safari_players s where s.phone = p_phone limit 1;
  if v is not null then
    if h is not null then raise exception 'phone_taken'; end if;
    update public.safari_players s set token_hash = public.liga_hash(t), first_name = p_first, last_name = p_last,
      region = coalesce(public.liga_region_ok(p_region), s.region) where s.id = v;
    return query select v, t; return;
  end if;
  if not exists (select 1 from public.liga_groups where code = g and active) then raise exception 'group_not_found'; end if;
  insert into public.safari_players(first_name, last_name, phone, group_code, region, token_hash)
    values (p_first, p_last, p_phone, g, public.liga_region_ok(p_region), public.liga_hash(t)) returning safari_players.id into v;
  return query select v, t;
end $$;

-- mavjud o'yinchilar (yangilanishdan oldin ro'yxatdan o'tganlar) kalitini bir marta oladi
create or replace function public.liga_claim(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare t text := public.liga_new_token();
begin
  update public.safari_players set token_hash = public.liga_hash(t) where id = p_id and token_hash is null;
  if not found then raise exception 'already_claimed'; end if;
  return t;
end $$;

-- natijani saqlash: faqat kalit bilan; hafta va ruxsat etilgan bosqichlarni server o'zi belgilaydi
create or replace function public.liga_save(p_id uuid, p_token text, p_xp int, p_stages int, p_streak int, p_first text, p_last text,
  p_week_daily int, p_week_blitz int, p_week_bonus int, p_week_stages jsonb, p_region text default null, p_acc_ok int default 0, p_acc_total int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare g text; allowed int[]; k text; v int; st jsonb := '{}'::jsonb; wid text := public.liga_cur_week_id();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select group_code into g from public.safari_players where id = p_id;
  allowed := public.liga_allowed_stages(g);
  for k, v in select key, coalesce((value)::text::int, 0) from jsonb_each(coalesce(p_week_stages, '{}'::jsonb)) loop
    if k ~ '^\d+$' and k::int = any(allowed) then st := st || jsonb_build_object(k, greatest(0, least(v, 450))); end if;
  end loop;
  update public.safari_players set xp = greatest(0, p_xp), week_id = wid, week_stages = st,
    week_daily = greatest(0, coalesce(p_week_daily,0)), week_blitz = greatest(0, coalesce(p_week_blitz,0)), week_bonus = greatest(0, coalesce(p_week_bonus,0)),
    stages = greatest(0, p_stages), streak = greatest(0, p_streak), last_active = now(),
    first_name = coalesce(nullif(trim(p_first),''), first_name), last_name = coalesce(p_last, last_name),
    region = coalesce(public.liga_region_ok(p_region), region),
    acc_ok = greatest(0, coalesce(p_acc_ok,0)), acc_total = greatest(0, coalesce(p_acc_total,0))
  where id = p_id;
end $$;

-- eski ochiq yozish funksiyalari — o'chiriladi
-- (eski funksiyalar alohida: db/2026-10-01c_eskilarni_ochirish.sql — yangi ilova joylangach)

-- ---------- 5. Admin funksiyalari (PIN himoyasi bilan; noto'g'ri PIN → bo'sh natija) ----------
drop function if exists public.liga_admin_list(text);
create function public.liga_admin_list(p_pin text)
returns table(id uuid, first_name text, last_name text, phone text, xp integer, week_xp integer, week_id text, stages integer, streak integer,
  last_active timestamptz, created_at timestamptz, week_stage integer, week_daily integer, week_blitz integer, week_stages jsonb, week_bonus integer,
  region text, acc_ok int, acc_total int, has_device boolean)
language plpgsql security definer set search_path to 'public' as $$
declare g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  return query select s.id, s.first_name, s.last_name, s.phone, s.xp, s.week_xp, s.week_id, s.stages, s.streak, s.last_active, s.created_at,
    coalesce(s.week_stage,0), coalesce(s.week_daily,0), coalesce(s.week_blitz,0), coalesce(s.week_stages,'{}'::jsonb), coalesce(s.week_bonus,0),
    s.region, s.acc_ok, s.acc_total, s.token_hash is not null
    from public.safari_players s where s.group_code = g order by s.created_at;
end $$;

drop function if exists public.liga_admin_group(text);
create function public.liga_admin_group(p_pin text)
returns table(code text, name text, paid_until date, ok boolean, members int, max_players int, start_date date, chats int, region text, price int)
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  return query select g.code, g.name, g.paid_until, public.liga_group_ok(g.code),
    (select count(*)::int from public.safari_players s where s.group_code = g.code), g.max_players, g.start_date,
    (select count(*)::int from public.liga_bot_chats c where c.group_code = g.code and c.active), g.region,
    (select value::int from public.liga_bot_config where key = 'price_per_member')
    from public.liga_groups g where g.admin_pin = p_pin;
end $$;

drop function if exists public.liga_admin_delete(text,uuid);
create function public.liga_admin_delete(p_pin text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  delete from public.safari_players where id = p_id and group_code = (select code from public.liga_groups where admin_pin = p_pin);
end $$;

-- yangi telefon: eski qurilma kaliti bekor qilinadi, o'yinchi shu raqam bilan qayta kiradi (natijalari saqlanadi)
create or replace function public.liga_admin_reset_device(p_pin text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  update public.safari_players set token_hash = null
  where id = p_id and group_code = (select code from public.liga_groups where admin_pin = p_pin);
end $$;

-- superadmin
drop function if exists public.liga_super_groups(text);
create function public.liga_super_groups(p_pin text)
returns table(code text, name text, admin_pin text, paid_until date, active boolean, ok boolean, members int, max_players int, created_at timestamptz, start_date date, chats int, region text, paid_total bigint)
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then return; end if;
  return query select g.code, g.name, g.admin_pin, g.paid_until, g.active, public.liga_group_ok(g.code),
    (select count(*)::int from public.safari_players s where s.group_code = g.code), g.max_players, g.created_at, g.start_date,
    (select count(*)::int from public.liga_bot_chats c where c.group_code = g.code and c.active), g.region,
    0::bigint
    from public.liga_groups g order by g.created_at;
end $$;

-- p_days: >0 — shuncha kun to'langan; 0 — to'lov kutilmoqda (to'lovdan keyin ochiladi); -1 — muddatsiz
drop function if exists public.liga_super_create(text,text,int,int,date);
create function public.liga_super_create(p_pin text, p_name text, p_days int default 30, p_max int default null, p_start date default null, p_region text default null)
returns table(code text, admin_pin text, paid_until date, start_date date)
language plpgsql security definer set search_path = public as $$
declare c text; pin text; until date; st date := coalesce(p_start, public.liga_next_monday());
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then return; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'bad_input'; end if;
  loop
    c := 'BX' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from public.liga_groups g where g.code = c);
  end loop;
  loop
    pin := lpad((floor(random()*90000000)+10000000)::bigint::text, 8, '0');
    exit when not exists (select 1 from public.liga_groups g where g.admin_pin = pin) and not public.liga_is_super(pin);
  end loop;
  until := case when p_days < 0 then null when p_days = 0 then public.liga_today() - 1 else greatest(st, public.liga_today()) + p_days - 1 end;
  insert into public.liga_groups(code, name, admin_pin, paid_until, max_players, start_date, region)
    values (c, trim(p_name), pin, until, p_max, st, public.liga_region_ok(p_region));
  return query select c, pin, until, st;
end $$;

drop function if exists public.liga_super_update(text,text,int,boolean);
create function public.liga_super_update(p_pin text, p_code text, p_add_days int default 0, p_active boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then return; end if;
  perform public.liga_extend(upper(p_code), coalesce(p_add_days,0));
  if p_active is not null then update public.liga_groups set active = p_active where code = upper(p_code); end if;
end $$;

-- obunani uzaytirish (to'lov yoki superadmin): bugundan yoki joriy muddatdan, qaysi kech bo'lsa
create or replace function public.liga_extend(p_code text, p_days int) returns date
language plpgsql security definer set search_path = public as $$
declare r date;
begin
  if p_days = 0 then return (select paid_until from public.liga_groups where code = p_code); end if;
  update public.liga_groups g set paid_until =
    greatest(coalesce(g.paid_until, public.liga_today() - 1), public.liga_today() - 1, g.start_date - 1) + p_days
  where g.code = p_code and g.paid_until is not null returning g.paid_until into r;
  return r;
end $$;

-- ro'yxatdan o'tish oldidan jamoa haqida (faol bo'lmasa ham ko'rinadi — to'lov kutilmoqda)
drop function if exists public.liga_group_public(text);
create function public.liga_group_public(p_code text)
returns table(code text, name text, ok boolean, start_date date, exists_active boolean)
language sql stable security definer set search_path = public as $$
  select g.code, g.name, public.liga_group_ok(g.code), g.start_date, g.active from public.liga_groups g where g.code = upper(trim(p_code))
$$;

-- ---------- 6. Viloyat ligasi (jamoalararo): o'tgan hafta, har jamoaning eng yaxshi 3 nafari yig'indisi ----------
create or replace function public.liga_group_region(p_code text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select region from public.liga_groups where code = p_code),
    (select region from public.safari_players where group_code = p_code and region is not null group by region order by count(*) desc limit 1))
$$;

create or replace function public.liga_region_league(p_id uuid default null)
returns table(region text, code text, name text, team_xp int, top3 text, rnk int, is_mine boolean, week_id text)
language sql stable security definer set search_path = public as $$
  with wid as (select public.liga_last_week_id() w),
  r as (select wr.group_code, wr.name, wr.week_xp, row_number() over (partition by wr.group_code order by wr.week_xp desc) pos
        from public.liga_week_results wr, wid where wr.week_id = wid.w and wr.week_xp > 0),
  t as (select r.group_code, sum(r.week_xp)::int xp, string_agg(r.name || ' ' || r.week_xp, ' · ' order by r.week_xp desc) names
        from r where pos <= 3 group by r.group_code)
  select coalesce(public.liga_group_region(t.group_code), 'Viloyat ko''rsatilmagan'), t.group_code, g.name, t.xp, t.names,
         (rank() over (partition by coalesce(public.liga_group_region(t.group_code), '-') order by t.xp desc))::int,
         t.group_code = public.liga_my_group(p_id), (select w from wid)
  from t join public.liga_groups g on g.code = t.group_code
  order by 1, t.xp desc
$$;

-- ---------- 7. Haftaning savoli ----------
create table if not exists public.liga_week_q(
  id bigserial primary key,
  group_code text not null references public.liga_groups(code) on update cascade,
  week_id text not null,                      -- savol chiqadigan hafta
  author_id uuid references public.safari_players(id) on delete set null,
  author_name text not null,
  q text not null, o jsonb not null, a int not null, e text not null default '',
  status text not null default 'pending',     -- pending | approved | rejected
  created_at timestamptz not null default now(),
  unique (group_code, week_id)
);
alter table public.liga_week_q enable row level security;
revoke all on public.liga_week_q from anon, authenticated;

-- o'tgan hafta g'olibimi? (taklif huquqi)
create or replace function public.liga_is_last_winner(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select r.player_id = p_id from public.liga_week_results r
    where r.group_code = public.liga_my_group(p_id) and r.week_id = public.liga_last_week_id() and r.week_xp > 0
    order by r.week_xp desc limit 1), false)
$$;

create or replace function public.liga_wq_state(p_id uuid)
returns table(can_submit boolean, my_status text, q_id bigint, q text, o jsonb, author text)
language sql stable security definer set search_path = public as $$
  select public.liga_is_last_winner(p_id) and not exists (select 1 from public.liga_week_q w where w.group_code = public.liga_my_group(p_id) and w.week_id = public.liga_cur_week_id()),
    (select w.status from public.liga_week_q w where w.group_code = public.liga_my_group(p_id) and w.week_id = public.liga_cur_week_id() and w.author_id = p_id),
    a.id, a.q, a.o, a.author_name
  from (select 1) x left join lateral (select w.* from public.liga_week_q w
    where w.group_code = public.liga_my_group(p_id) and w.week_id = public.liga_cur_week_id() and w.status = 'approved' limit 1) a on true
$$;

create or replace function public.liga_wq_submit(p_id uuid, p_token text, p_q text, p_o jsonb, p_a int, p_e text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_is_last_winner(p_id) then raise exception 'not_winner'; end if;
  if length(trim(coalesce(p_q,''))) < 10 or jsonb_typeof(p_o) <> 'array' or jsonb_array_length(p_o) not between 2 and 5
     or p_a < 0 or p_a >= jsonb_array_length(p_o) then raise exception 'bad_input'; end if;
  insert into public.liga_week_q(group_code, week_id, author_id, author_name, q, o, a, e)
  select s.group_code, public.liga_cur_week_id(), s.id, trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.'),
         left(trim(p_q), 400), p_o, p_a, left(coalesce(p_e,''), 400)
  from public.safari_players s where s.id = p_id;
end $$;

-- javob tekshiruvi serverda (to'g'ri javob ilovaga oldindan berilmaydi)
create or replace function public.liga_wq_answer(p_id uuid, p_token text, p_q bigint, p_pick int)
returns table(ok boolean, a int, e text) language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return query select w.a = p_pick, w.a, w.e from public.liga_week_q w
    where w.id = p_q and w.status = 'approved' and w.group_code = public.liga_my_group(p_id);
end $$;

create or replace function public.liga_wq_admin(p_pin text)
returns table(id bigint, week_id text, author_name text, q text, o jsonb, a int, e text, status text)
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  return query select w.id, w.week_id, w.author_name, w.q, w.o, w.a, w.e, w.status from public.liga_week_q w
    where w.group_code = (select code from public.liga_groups where admin_pin = p_pin) order by w.created_at desc limit 10;
end $$;

create or replace function public.liga_wq_decide(p_pin text, p_qid bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  update public.liga_week_q set status = case when p_ok then 'approved' else 'rejected' end
  where id = p_qid and group_code = (select code from public.liga_groups where admin_pin = p_pin);
end $$;

-- ---------- 8. Oylik chempionat finali ----------
-- oy (YYYY-MM) haftalari: juma (hafta oxiri) shu oyga tushadi. Saralash: ≥2 marta top-3; kam bo'lsa — oylik yig'indi bo'yicha top-3
-- Final: oyning oxirgi shanbasi 10:00–13:00 (Toshkent)
create or replace function public.liga_final_date(p_month text) returns date language sql immutable as $$
  select d from (select (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date e) x,
    lateral (select (e - ((extract(isodow from e)::int + 1) % 7))::date d) y
$$;
create or replace function public.liga_month_now() returns text language sql stable as $$
  select to_char(public.liga_today(), 'YYYY-MM')
$$;

create table if not exists public.liga_finals(
  month text not null, player_id uuid not null references public.safari_players(id) on delete cascade,
  group_code text not null, score int not null, ms int not null, done_at timestamptz not null default now(),
  primary key (month, player_id)
);
alter table public.liga_finals enable row level security;
revoke all on public.liga_finals from anon, authenticated;

create or replace function public.liga_final_qualifiers(p_code text, p_month text)
returns table(player_id uuid, name text, tops int, month_xp int)
language sql stable security definer set search_path = public as $$
  with w as (select r.*, row_number() over (partition by r.week_id order by r.week_xp desc) pos
             from public.liga_week_results r
             where r.group_code = p_code and r.week_xp > 0 and substr(r.week_id,1,7) = p_month and r.week_id <= public.liga_last_week_id()),
  agg as (select w.player_id, max(w.name) name, count(*) filter (where pos <= 3)::int tops, sum(w.week_xp)::int xp from w group by w.player_id),
  q as (select * from agg where tops >= 2)
  select a.player_id, a.name, a.tops, a.xp from agg a
  where a.player_id in (select player_id from q)
     or ((select count(*) from q) < 3 and a.player_id in (select player_id from agg order by xp desc limit 3))
  order by a.tops desc, a.xp desc
$$;

create or replace function public.liga_final_info(p_id uuid)
returns table(month text, final_date date, open_now boolean, ended boolean, qualified boolean, my_score int, my_ms int,
              qualifiers jsonb, standings jsonb)
language sql stable security definer set search_path = public as $$
  with m as (select public.liga_month_now() mm, public.liga_my_group(p_id) g),
  d as (select m.*, public.liga_final_date(m.mm) fd from m),
  t as (select d.*, (now() at time zone 'Asia/Tashkent') nowt from d)
  select t.mm, t.fd,
    t.nowt::date = t.fd and t.nowt::time between time '10:00' and time '13:00',
    t.nowt > (t.fd + time '13:00'),
    exists (select 1 from public.liga_final_qualifiers(t.g, t.mm) q where q.player_id = p_id),
    (select f.score from public.liga_finals f where f.month = t.mm and f.player_id = p_id),
    (select f.ms from public.liga_finals f where f.month = t.mm and f.player_id = p_id),
    coalesce((select jsonb_agg(jsonb_build_object('n', q.name, 'tops', q.tops, 'xp', q.month_xp, 'me', q.player_id = p_id))
              from public.liga_final_qualifiers(t.g, t.mm) q), '[]'::jsonb),
    case when t.nowt > (t.fd + time '13:00') then coalesce((select jsonb_agg(jsonb_build_object('n', q.name, 's', f.score, 'ms', f.ms, 'me', f.player_id = p_id) order by f.score desc, f.ms asc)
              from public.liga_finals f join public.liga_final_qualifiers(t.g, t.mm) q on q.player_id = f.player_id
              where f.month = t.mm and f.group_code = t.g), '[]'::jsonb) else '[]'::jsonb end
  from t
$$;

create or replace function public.liga_final_submit(p_id uuid, p_token text, p_score int, p_ms int) returns void
language plpgsql security definer set search_path = public as $$
declare mm text := public.liga_month_now(); g text; nowt timestamp := now() at time zone 'Asia/Tashkent';
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  g := public.liga_my_group(p_id);
  if nowt::date <> public.liga_final_date(mm) or nowt::time not between time '10:00' and time '13:05' then raise exception 'final_closed'; end if;
  if not exists (select 1 from public.liga_final_qualifiers(g, mm) q where q.player_id = p_id) then raise exception 'not_qualified'; end if;
  insert into public.liga_finals(month, player_id, group_code, score, ms) values (mm, p_id, g, greatest(0, least(p_score, 400)), greatest(0, p_ms))
  on conflict (month, player_id) do nothing;
end $$;

-- ---------- 9. Rahbar uchun oylik hisobot ----------
create or replace function public.liga_admin_month(p_pin text, p_month text)
returns table(id uuid, name text, phone text, region text, weeks jsonb, month_xp int, tops int, acc_ok int, acc_total int, last_active timestamptz, final_score int)
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  return query
  with w as (select r.*, row_number() over (partition by r.week_id order by r.week_xp desc) pos
             from public.liga_week_results r where r.group_code = g and substr(r.week_id,1,7) = p_month),
  cur as (select s.id player_id, s.week_id, s.week_xp from public.safari_players s
          where s.group_code = g and substr(s.week_id,1,7) = p_month and s.week_id > public.liga_last_week_id())
  select s.id, trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')), s.phone, s.region,
    coalesce((select jsonb_object_agg(x.week_id, x.week_xp) from (select w.week_id, w.week_xp from w where w.player_id = s.id
       union all select c.week_id, c.week_xp from cur c where c.player_id = s.id) x), '{}'::jsonb),
    coalesce((select sum(w.week_xp) from w where w.player_id = s.id),0)::int + coalesce((select sum(c.week_xp) from cur c where c.player_id = s.id),0)::int,
    (select count(*)::int from w where w.player_id = s.id and w.pos <= 3 and w.week_xp > 0),
    s.acc_ok, s.acc_total, s.last_active,
    (select f.score from public.liga_finals f where f.month = p_month and f.player_id = s.id)
  from public.safari_players s where s.group_code = g order by 6 desc;
end $$;

-- ---------- 10. To'lovlar (Payme / Click) ----------
create table if not exists public.liga_invoices(
  id bigserial primary key,
  group_code text not null references public.liga_groups(code) on update cascade,
  members int not null, months int not null, amount bigint not null,     -- so'm
  status text not null default 'new',                                   -- new | paid | cancelled
  provider text, provider_tx text,
  created_at timestamptz not null default now(), paid_at timestamptz
);
create table if not exists public.liga_payme_tx(
  id text primary key, invoice_id bigint not null references public.liga_invoices(id),
  amount bigint not null, state int not null, create_time bigint not null,
  perform_time bigint not null default 0, cancel_time bigint not null default 0, reason int
);
create table if not exists public.liga_click_tx(
  click_trans_id bigint primary key, invoice_id bigint not null references public.liga_invoices(id),
  amount numeric not null, state int not null default 0, created_at timestamptz not null default now()
);
alter table public.liga_invoices enable row level security;
alter table public.liga_payme_tx enable row level security;
alter table public.liga_click_tx enable row level security;
revoke all on public.liga_invoices, public.liga_payme_tx, public.liga_click_tx from anon, authenticated;

-- to'lov sozlamalari (ochiq qism: merchant/servis raqamlari; maxfiy kalitlar Edge Function Secrets'da)
insert into public.liga_bot_config(key, value) values ('payme_merchant_id', ''), ('click_service_id', ''), ('click_merchant_id', '')
on conflict (key) do nothing;

create or replace function public.liga_pay_config() returns table(payme_merchant_id text, click_service_id text, click_merchant_id text, price int)
language sql stable security definer set search_path = public as $$
  select (select value from public.liga_bot_config where key = 'payme_merchant_id'),
         (select value from public.liga_bot_config where key = 'click_service_id'),
         (select value from public.liga_bot_config where key = 'click_merchant_id'),
         (select value::int from public.liga_bot_config where key = 'price_per_member')
$$;

-- admin hisob-faktura yaratadi: a'zolar × narx × oy
create or replace function public.liga_admin_invoice(p_pin text, p_months int default 1)
returns table(id bigint, amount bigint, members int, months int)
language plpgsql security definer set search_path = public as $$
declare g text; n int; pr int; m int := greatest(1, least(coalesce(p_months,1), 12)); inv bigint;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  select greatest(1, count(*))::int into n from public.safari_players where group_code = g;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  insert into public.liga_invoices(group_code, members, months, amount) values (g, n, m, n::bigint * pr * m) returning liga_invoices.id into inv;
  return query select inv, n::bigint * pr * m, n, m;
end $$;

create or replace function public.liga_admin_invoices(p_pin text)
returns table(id bigint, amount bigint, members int, months int, status text, provider text, created_at timestamptz, paid_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  return query select i.id, i.amount, i.members, i.months, i.status, i.provider, i.created_at, i.paid_at from public.liga_invoices i
    where i.group_code = (select code from public.liga_groups where admin_pin = p_pin) order by i.created_at desc limit 12;
end $$;

-- to'lov tasdiqlanganda (faqat Edge Function / service_role chaqiradi)
create or replace function public.liga_invoice_paid(p_invoice bigint, p_provider text, p_tx text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.liga_invoices where id = p_invoice for update;
  if inv is null or inv.status <> 'new' then return false; end if;
  update public.liga_invoices set status = 'paid', provider = p_provider, provider_tx = p_tx, paid_at = now() where id = p_invoice;
  perform public.liga_extend(inv.group_code, 30 * inv.months);
  return true;
end $$;

-- ---------- 11. Huquqlar ----------
revoke all on function
  public.liga_regions(), public.liga_region_ok(text), public.liga_cur_week_id(), public.liga_today(), public.liga_stage_index(date,date),
  public.liga_allowed_stages(text), public.liga_client_ip(), public.liga_pin_role(text), public.liga_pin_check(text), public.liga_hash(text),
  public.liga_new_token(), public.liga_auth(uuid,text), public.liga_join2(text,text,text,text,text), public.liga_claim(uuid),
  public.liga_save(uuid,text,int,int,int,text,text,int,int,int,jsonb,text,int,int),
  public.liga_admin_list(text), public.liga_admin_group(text), public.liga_admin_delete(text,uuid), public.liga_admin_reset_device(text,uuid),
  public.liga_super_groups(text), public.liga_super_create(text,text,int,int,date,text), public.liga_super_update(text,text,int,boolean),
  public.liga_extend(text,int), public.liga_group_public(text), public.liga_group_region(text), public.liga_region_league(uuid),
  public.liga_is_last_winner(uuid), public.liga_wq_state(uuid), public.liga_wq_submit(uuid,text,text,jsonb,int,text),
  public.liga_wq_answer(uuid,text,bigint,int), public.liga_wq_admin(text), public.liga_wq_decide(text,bigint,boolean),
  public.liga_final_date(text), public.liga_month_now(), public.liga_final_qualifiers(text,text), public.liga_final_info(uuid),
  public.liga_final_submit(uuid,text,int,int), public.liga_admin_month(text,text), public.liga_pay_config(),
  public.liga_admin_invoice(text,int), public.liga_admin_invoices(text), public.liga_invoice_paid(bigint,text,text)
from public;

grant execute on function
  public.liga_pin_check(text), public.liga_join2(text,text,text,text,text), public.liga_claim(uuid),
  public.liga_save(uuid,text,int,int,int,text,text,int,int,int,jsonb,text,int,int),
  public.liga_admin_list(text), public.liga_admin_group(text), public.liga_admin_delete(text,uuid), public.liga_admin_reset_device(text,uuid),
  public.liga_super_groups(text), public.liga_super_create(text,text,int,int,date,text), public.liga_super_update(text,text,int,boolean),
  public.liga_group_public(text), public.liga_region_league(uuid),
  public.liga_wq_state(uuid), public.liga_wq_submit(uuid,text,text,jsonb,int,text), public.liga_wq_answer(uuid,text,bigint,int),
  public.liga_wq_admin(text), public.liga_wq_decide(text,bigint,boolean),
  public.liga_final_info(uuid), public.liga_final_submit(uuid,text,int,int), public.liga_admin_month(text,text), public.liga_pay_config(),
  public.liga_admin_invoice(text,int), public.liga_admin_invoices(text)
to anon, authenticated;
grant execute on function public.liga_invoice_paid(bigint,text,text), public.liga_extend(text,int), public.liga_cur_week_id(),
  public.liga_today(), public.liga_final_date(text), public.liga_final_qualifiers(text,text), public.liga_group_region(text) to service_role;
