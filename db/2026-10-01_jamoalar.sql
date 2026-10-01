-- Hisobchi Liga — jamoalar (ko'p guruhli liga), cheklovsiz ishtirokchilar, superadmin
-- Har bir jamoa: o'z kodi, nomi, admin PIN, obuna muddati (paid_until), ixtiyoriy max_players.
-- Mavjud o'yinchilar va guruh "ASOSIY" jamoasiga o'tadi (admin PIN o'zgarmaydi).

create table if not exists public.liga_groups(
  code text primary key,
  name text not null,
  admin_pin text not null unique,
  paid_until date,                 -- null = muddatsiz
  active boolean not null default true,
  max_players int,                 -- null = cheklovsiz
  created_at timestamptz not null default now()
);
alter table public.liga_groups enable row level security;
revoke all on public.liga_groups from anon, authenticated;

insert into public.liga_groups(code, name, admin_pin)
select 'ASOSIY', 'Buxgalterlar ligasi', value from public.liga_bot_config where key = 'admin_pin'
on conflict (code) do nothing;

insert into public.liga_bot_config(key, value)
values ('super_pin', lpad((floor(random()*90000000)+10000000)::bigint::text, 8, '0'))
on conflict (key) do nothing;

alter table public.safari_players add column if not exists group_code text not null default 'ASOSIY';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'safari_players_group_fk') then
    alter table public.safari_players add constraint safari_players_group_fk
      foreign key (group_code) references public.liga_groups(code) on update cascade;
  end if;
end $$;
create index if not exists safari_players_group_idx on public.safari_players(group_code);

alter table public.liga_week_results add column if not exists group_code text not null default 'ASOSIY';
alter table public.liga_bot_chats add column if not exists group_code text not null default 'ASOSIY';

-- eski "7/8 kishi" cheklovi o'rniga: faqat jamoaning max_players (berilgan bo'lsa)
drop trigger if exists safari_limit_trg on public.safari_players;
create or replace function public.safari_group_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare mx int;
begin
  select max_players into mx from public.liga_groups where code = new.group_code;
  if mx is not null and (select count(*) from public.safari_players where group_code = new.group_code) >= mx then
    raise exception 'safari_full';
  end if;
  return new;
end $$;
drop trigger if exists safari_group_limit_trg on public.safari_players;
create trigger safari_group_limit_trg before insert on public.safari_players
  for each row execute function public.safari_group_limit();

-- jamoa faolmi (obuna muddati)
create or replace function public.liga_group_ok(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.liga_groups g where g.code = p_code and g.active
                and (g.paid_until is null or g.paid_until >= (now() at time zone 'Asia/Tashkent')::date))
$$;

-- haftalik yakun: jamoa kodi bilan saqlanadi
create or replace function public.liga_snapshot_week() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.week_id is distinct from new.week_id and coalesce(old.week_xp,0) > 0 and old.week_id is not null then
    insert into public.liga_week_results(week_id, player_id, name, week_xp, week_stage, week_daily, week_blitz, week_stages, week_bonus, group_code)
    values (old.week_id, old.id, trim(coalesce(old.first_name,'')||' '||left(coalesce(old.last_name,''),1)||'.'), old.week_xp,
            coalesce(old.week_stage,0), coalesce(old.week_daily,0), coalesce(old.week_blitz,0), coalesce(old.week_stages,'{}'::jsonb), coalesce(old.week_bonus,0), old.group_code)
    on conflict (week_id, player_id) do update set week_xp = excluded.week_xp, name = excluded.name,
      week_stage = excluded.week_stage, week_daily = excluded.week_daily, week_blitz = excluded.week_blitz,
      week_stages = excluded.week_stages, week_bonus = excluded.week_bonus, group_code = excluded.group_code;
  end if;
  return new;
end $$;

-- ro'yxatdan o'tish: jamoa kodi bilan (eski 3 argumentli chaqiruv ham ishlaydi → ASOSIY)
drop function if exists public.liga_join(text,text,text);
create or replace function public.liga_join(p_first text, p_last text, p_phone text, p_group text default 'ASOSIY') returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; g text := upper(coalesce(nullif(trim(p_group),''),'ASOSIY'));
begin
  if coalesce(trim(p_first),'') = '' or coalesce(p_phone,'') !~ '^\+998\d{9}$' then raise exception 'bad_input'; end if;
  select id into v from public.safari_players where phone = p_phone limit 1;
  if v is not null then
    update public.safari_players set first_name = p_first, last_name = p_last where id = v;
    return v;
  end if;
  if not exists (select 1 from public.liga_groups where code = g) then raise exception 'group_not_found'; end if;
  if not public.liga_group_ok(g) then raise exception 'group_inactive'; end if;
  insert into public.safari_players(first_name, last_name, phone, group_code) values (p_first, p_last, p_phone, g) returning id into v;
  return v;
end $$;

create or replace function public.liga_my_group(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select group_code from public.safari_players where id = p_id), 'ASOSIY')
$$;

-- jamoa haqida (ilova banneri uchun)
create or replace function public.liga_group_info(p_id uuid)
returns table(code text, name text, paid_until date, ok boolean, members int)
language sql stable security definer set search_path = public as $$
  select g.code, g.name, g.paid_until, public.liga_group_ok(g.code),
         (select count(*)::int from public.safari_players s where s.group_code = g.code)
  from public.liga_groups g where g.code = public.liga_my_group(p_id)
$$;

drop function if exists public.liga_count();
create or replace function public.liga_count(p_id uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.safari_players where group_code = public.liga_my_group(p_id)
$$;

-- o'tgan hafta medali (1–3) bilan a'zolar ro'yxati
drop function if exists public.liga_members(uuid);
create or replace function public.liga_members(p_id uuid default null)
returns table(name text, is_me boolean, medal int)
language sql stable security definer set search_path = public as $$
  with g as (select public.liga_my_group(p_id) code),
  last as (
    select r.player_id, row_number() over (order by r.week_xp desc) pos
    from public.liga_week_results r, g
    where r.group_code = g.code and r.week_id = public.liga_last_week_id() and r.week_xp > 0
  )
  select trim(coalesce(s.first_name,'')||' '||left(coalesce(s.last_name,''),1)||'.'), s.id = p_id,
         (select case when l.pos <= 3 then l.pos::int end from last l where l.player_id = s.id)
  from public.safari_players s, g where s.group_code = g.code order by s.created_at
$$;

-- tugagan hafta natijalari — jamoa bo'yicha
create or replace function public.liga_results_group(p_code text, p_id uuid default null)
returns table(week_id text, name text, week_xp integer, is_me boolean, week_stage integer, week_daily integer, week_blitz integer, week_stages jsonb, week_bonus integer)
language plpgsql security definer set search_path to 'public' as $$
declare wid text := public.liga_last_week_id();
begin
  insert into public.liga_week_results(week_id, player_id, name, week_xp, week_stage, week_daily, week_blitz, week_stages, week_bonus, group_code)
  select p.week_id, p.id, trim(coalesce(p.first_name,'')||' '||left(coalesce(p.last_name,''),1)||'.'), p.week_xp,
         coalesce(p.week_stage,0), coalesce(p.week_daily,0), coalesce(p.week_blitz,0), coalesce(p.week_stages,'{}'::jsonb), coalesce(p.week_bonus,0), p.group_code
  from public.safari_players p where p.week_id = wid and p.group_code = p_code and (p.week_xp > 0 or p.week_daily > 0 or p.week_blitz > 0)
  on conflict on constraint liga_week_results_pkey do update set week_xp = excluded.week_xp, name = excluded.name,
    week_stage = excluded.week_stage, week_daily = excluded.week_daily, week_blitz = excluded.week_blitz,
    week_stages = excluded.week_stages, week_bonus = excluded.week_bonus, group_code = excluded.group_code;
  return query select r.week_id, r.name, r.week_xp, (r.player_id = p_id), coalesce(r.week_stage,0), coalesce(r.week_daily,0), coalesce(r.week_blitz,0), coalesce(r.week_stages,'{}'::jsonb), coalesce(r.week_bonus,0)
    from public.liga_week_results r where r.week_id = wid and r.group_code = p_code order by r.week_xp desc;
end $$;

drop function if exists public.liga_results(uuid);
create or replace function public.liga_results(p_id uuid default null)
returns table(week_id text, name text, week_xp integer, is_me boolean, week_stage integer, week_daily integer, week_blitz integer, week_stages jsonb, week_bonus integer)
language sql security definer set search_path to 'public' as $$
  select * from public.liga_results_group(public.liga_my_group(p_id), p_id)
$$;

-- chempionlar zali: oxirgi 12 haftaning top-3
create or replace function public.liga_champions(p_id uuid default null)
returns table(week_id text, pos int, name text, week_xp int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select week_id, pos::int, name, week_xp, player_id = p_id from (
    select r.*, row_number() over (partition by r.week_id order by r.week_xp desc) pos
    from public.liga_week_results r
    where r.group_code = public.liga_my_group(p_id) and r.week_xp > 0
      and r.week_id <= public.liga_last_week_id()
  ) x where pos <= 3 and week_id in (
    select distinct week_id from public.liga_week_results where group_code = public.liga_my_group(p_id) and week_id <= public.liga_last_week_id()
    order by week_id desc limit 12)
  order by week_id desc, pos
$$;

-- jamoa admini: faqat o'z jamoasi
drop function if exists public.liga_admin_list(text);
create function public.liga_admin_list(p_pin text)
returns table(id uuid, first_name text, last_name text, phone text, xp integer, week_xp integer, week_id text, stages integer, streak integer,
  last_active timestamptz, created_at timestamptz, week_stage integer, week_daily integer, week_blitz integer, week_stages jsonb, week_bonus integer)
language plpgsql security definer set search_path to 'public' as $$
declare g text;
begin
  select code into g from public.liga_groups where admin_pin = p_pin;
  if p_pin is null or g is null then raise exception 'not_admin'; end if;
  return query select s.id, s.first_name, s.last_name, s.phone, s.xp, s.week_xp, s.week_id, s.stages, s.streak, s.last_active, s.created_at,
    coalesce(s.week_stage,0), coalesce(s.week_daily,0), coalesce(s.week_blitz,0), coalesce(s.week_stages,'{}'::jsonb), coalesce(s.week_bonus,0)
    from public.safari_players s where s.group_code = g order by s.created_at;
end $$;

create or replace function public.liga_admin_group(p_pin text)
returns table(code text, name text, paid_until date, ok boolean, members int, max_players int)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.liga_groups where admin_pin = p_pin) then raise exception 'not_admin'; end if;
  return query select g.code, g.name, g.paid_until, public.liga_group_ok(g.code),
    (select count(*)::int from public.safari_players s where s.group_code = g.code), g.max_players
    from public.liga_groups g where g.admin_pin = p_pin;
end $$;

drop function if exists public.liga_admin_delete(text,uuid);
create or replace function public.liga_admin_delete(p_pin text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  select code into g from public.liga_groups where admin_pin = p_pin;
  if p_pin is null or g is null then raise exception 'not_admin'; end if;
  delete from public.safari_players where id = p_id and group_code = g;
end $$;

-- superadmin (sotuvchi): jamoalarni yaratish va boshqarish
create or replace function public.liga_is_super(p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_pin is not null and p_pin = (select value from public.liga_bot_config where key = 'super_pin')
$$;

create or replace function public.liga_super_groups(p_pin text)
returns table(code text, name text, admin_pin text, paid_until date, active boolean, ok boolean, members int, max_players int, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_is_super(p_pin) then raise exception 'not_super'; end if;
  return query select g.code, g.name, g.admin_pin, g.paid_until, g.active, public.liga_group_ok(g.code),
    (select count(*)::int from public.safari_players s where s.group_code = g.code), g.max_players, g.created_at
    from public.liga_groups g order by g.created_at;
end $$;

create or replace function public.liga_super_create(p_pin text, p_name text, p_days int default 14, p_max int default null)
returns table(code text, admin_pin text, paid_until date)
language plpgsql security definer set search_path = public as $$
declare c text; pin text; until date;
begin
  if not public.liga_is_super(p_pin) then raise exception 'not_super'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'bad_input'; end if;
  loop
    c := 'BX' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from public.liga_groups g where g.code = c);
  end loop;
  loop
    pin := lpad((floor(random()*90000000)+10000000)::bigint::text, 8, '0');
    exit when not exists (select 1 from public.liga_groups g where g.admin_pin = pin) and not public.liga_is_super(pin);
  end loop;
  until := case when p_days is null or p_days <= 0 then null else (now() at time zone 'Asia/Tashkent')::date + p_days end;
  insert into public.liga_groups(code, name, admin_pin, paid_until, max_players) values (c, trim(p_name), pin, until, p_max);
  return query select c, pin, until;
end $$;

create or replace function public.liga_super_update(p_pin text, p_code text, p_add_days int default 0, p_active boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.liga_is_super(p_pin) then raise exception 'not_super'; end if;
  update public.liga_groups g set
    paid_until = case when coalesce(p_add_days,0) = 0 then g.paid_until
                      else greatest(coalesce(g.paid_until, (now() at time zone 'Asia/Tashkent')::date), (now() at time zone 'Asia/Tashkent')::date) + p_add_days end,
    active = coalesce(p_active, g.active)
  where g.code = upper(p_code);
end $$;

-- huquqlar
revoke all on function public.liga_join(text,text,text,text), public.liga_my_group(uuid), public.liga_group_info(uuid), public.liga_count(uuid),
  public.liga_members(uuid), public.liga_results_group(text,uuid), public.liga_results(uuid), public.liga_champions(uuid),
  public.liga_admin_list(text), public.liga_admin_group(text), public.liga_admin_delete(text,uuid), public.liga_is_super(text),
  public.liga_super_groups(text), public.liga_super_create(text,text,int,int), public.liga_super_update(text,text,int,boolean),
  public.liga_group_ok(text), public.safari_group_limit() from public;
grant execute on function public.liga_join(text,text,text,text), public.liga_group_info(uuid), public.liga_count(uuid),
  public.liga_members(uuid), public.liga_results(uuid), public.liga_champions(uuid),
  public.liga_admin_list(text), public.liga_admin_group(text), public.liga_admin_delete(text,uuid),
  public.liga_super_groups(text), public.liga_super_create(text,text,int,int), public.liga_super_update(text,text,int,boolean)
  to anon, authenticated;
grant execute on function public.liga_results_group(text,uuid), public.liga_results(uuid), public.liga_my_group(uuid), public.liga_group_ok(text) to service_role;
