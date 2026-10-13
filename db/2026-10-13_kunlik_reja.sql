-- 2026-10-13 · Sanaga bog'langan kunlik reja: 14–30.10.2026, har kuni 15 provodka + 5 qonun/kodeks savoli (osondan qiyinga)
-- Savollar liga_bank da: id = dYYYYMMDD-NN (01..15 — provodka, 16..20 — qonun), pool = dYYYYMMDD.
-- Manba: content/oct.asc (shifrlangan, kalit — liga_bot_config.bank_key). Yuklash: liga_plan_load_sys(asc).
-- Reja bo'lmagan kunlar — eski tartib (s0..s11 dan 12+8).

create table if not exists public.liga_day_plan (
  day date primary key,
  pool text not null,
  level int not null default 1,
  icon text,
  title jsonb not null,      -- {"uz","ru"}
  story jsonb,
  theory jsonb,
  n_pv int not null default 15,
  n_other int not null default 5,
  created_at timestamptz not null default now()
);
alter table public.liga_day_plan enable row level security;

-- ochiq ma'lumot (savolsiz): mavzu, nazariya — ilova va bot uchun
create or replace function public.liga_day_plans()
returns table(day date, level int, icon text, title jsonb, story jsonb, theory jsonb, n_pv int, n_other int)
language sql stable security definer set search_path = public as $$
  select p.day, p.level, p.icon, p.title, p.story, p.theory, p.n_pv, p.n_other
  from public.liga_day_plan p where p.day >= public.liga_today() - 14 order by p.day
$$;
grant execute on function public.liga_day_plans() to anon, authenticated;

-- shifrlangan manbadan yuklash (faqat server): {plans:[...], questions:[...]}
create or replace function public.liga_plan_load_sys(p_asc text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare j jsonb; k text; np int := 0; nq int := 0; x jsonb;
begin
  select value into k from public.liga_bot_config where key = 'bank_key';
  j := convert_from(extensions.pgp_sym_decrypt_bytea(extensions.dearmor(p_asc), k), 'UTF8')::jsonb;
  for x in select * from jsonb_array_elements(j->'questions') loop
    insert into public.liga_bank(id, pool, t, uz, ru, dt, kt, a, active)
    values (x->>'id', x->>'pool', x->>'t', x->'uz', x->'ru', x->>'dt', x->>'kt', (x->>'a')::numeric, true)
    on conflict (id) do update set pool = excluded.pool, t = excluded.t, uz = excluded.uz, ru = excluded.ru,
      dt = excluded.dt, kt = excluded.kt, a = excluded.a, active = true;
    nq := nq + 1;
  end loop;
  for x in select * from jsonb_array_elements(j->'plans') loop
    insert into public.liga_day_plan(day, pool, level, icon, title, story, theory)
    values ((x->>'day')::date, x->>'pool', (x->>'level')::int, x->>'icon', x->'title', x->'story', x->'theory')
    on conflict (day) do update set pool = excluded.pool, level = excluded.level, icon = excluded.icon,
      title = excluded.title, story = excluded.story, theory = excluded.theory;
    np := np + 1;
  end loop;
  return jsonb_build_object('plans', np, 'questions', nq);
end $$;
revoke all on function public.liga_plan_load_sys(text) from public, anon, authenticated;

-- bugungi reja bo'yicha savollar: provodkalar keyin qonun savollari, har biri osondan qiyinga (id tartibi)
create or replace function public.liga_plan_draw(p_day date)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by grp, id), '{}') from (
    (select b.id, 0 grp from public.liga_bank b join public.liga_day_plan p on p.day = p_day
       where b.pool = p.pool and b.active and b.t = 'pv' order by b.id limit (select n_pv from public.liga_day_plan where day = p_day))
    union all
    (select b.id, 1 grp from public.liga_bank b join public.liga_day_plan p on p.day = p_day
       where b.pool = p.pool and b.active and b.t <> 'pv' order by b.id limit (select n_other from public.liga_day_plan where day = p_day))) x
$$;
revoke all on function public.liga_plan_draw(date) from public, anon, authenticated;

create or replace function public.liga_stage_start(p_id uuid, p_token text, p_si integer, p_lang text DEFAULT 'uz'::text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g text; wid text := public.liga_cur_week_id(); rid uuid; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  g := public.liga_my_group(p_id);
  if p_si is null or p_si < 0 or p_si > 11 or not public.liga_stage_window(g, p_si, 0) then raise exception 'stage_closed'; end if;
  select id into rid from public.liga_runs where kind = 'stage' and player_id = p_id and ref = p_si::text and week_id = wid;
  if rid is null then
    -- sanaga bog'langan reja bo'lsa — shu kunning 15+5 savoli; bo'lmasa eski tartib
    if exists (select 1 from public.liga_day_plan where day = public.liga_today()) then
      q := public.liga_plan_draw(public.liga_today());
    else
      q := public.liga_draw(array['s' || p_si], p_id::text || '|' || wid || '|' || p_si, 12, 0, 0, 8);
    end if;
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

-- bot uchun: bugungi mavzu
create or replace function public.liga_plan_today_sys()
returns table(day date, level int, icon text, title jsonb) language sql stable security definer set search_path = public as $$
  select p.day, p.level, p.icon, p.title from public.liga_day_plan p where p.day = public.liga_today()
$$;
revoke all on function public.liga_plan_today_sys() from public, anon, authenticated;
