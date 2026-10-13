-- 2026-10-13 · Dekabr Katta finali
-- Oktyabr oyining kuchli uchligi + noyabr oyining kuchli uchligi (oktyabrdagilar takrorlansa — noyabrning keyingisi) = 6 finalchi.
-- Oy reytingi: shu oyda tugaydigan (juma 12:00 da yakunlangan) liga haftalari bali yig'indisi. Joriy hafta qo'shilmaydi —
-- hafta davomida boshqalarning bali yashirin qoidasi buzilmasin; reyting har juma yangilanadi.
-- Final: 05.12.2026 (shanba) 10:00–13:00, 20 savol (12 provodka + 8 qonun), oktyabr–noyabr rejasining eng qiyin kunlaridan.
-- Oktyabr va noyabrdagi oddiy oylik finallar shu Katta final bilan almashtirildi.

insert into public.liga_bot_config(key, value) values
  ('gf_months', '2026-10,2026-11'), ('gf_month', '2026-12'), ('gf_date', '2026-12-05')
on conflict (key) do nothing;

create or replace function public.liga_gf_cfg(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value from public.liga_bot_config where key = p_key
$$;
revoke all on function public.liga_gf_cfg(text) from public, anon, authenticated;

-- oy reytingi (jamoa bo'yicha)
create or replace function public.liga_month_rank(p_code text, p_month text)
returns table(pos int, player_id uuid, name text, xp int)
language sql stable security definer set search_path = public as $$
  with done as (
    select r.player_id, r.week_xp xp from public.liga_week_results r
    where r.group_code = p_code and substr(r.week_id, 1, 7) = p_month and r.week_id <= public.liga_last_week_id() and r.week_xp > 0),
  agg as (select player_id, sum(xp)::int xp from done group by player_id)
  select (row_number() over (order by a.xp desc, s.created_at))::int, a.player_id,
         trim(coalesce(s.first_name, '') || ' ' || coalesce(left(s.last_name, 1) || '.', '')), a.xp
  from agg a join public.safari_players s on s.id = a.player_id
  order by 1
$$;
revoke all on function public.liga_month_rank(text, text) from public, anon, authenticated;

-- Katta final finalchilari: oktyabr top-3 + noyabr top-3 (takrorlanmasin)
create or replace function public.liga_gf_qualifiers(p_code text)
returns table(player_id uuid, name text, src_month text, src_pos int, xp int)
language sql stable security definer set search_path = public as $$
  with m as (select split_part(public.liga_gf_cfg('gf_months'), ',', 1) m1, split_part(public.liga_gf_cfg('gf_months'), ',', 2) m2),
  a as (select r.*, m.m1 mm from m, public.liga_month_rank(p_code, m.m1) r where r.pos <= 3),
  b as (select r.*, m.m2 mm from m, public.liga_month_rank(p_code, m.m2) r
        where r.player_id not in (select player_id from a) order by r.pos limit 3)
  select player_id, name, mm, pos, xp from a
  union all select player_id, name, mm, pos, xp from b
$$;
revoke all on function public.liga_gf_qualifiers(text) from public, anon, authenticated;

-- eski oylik saralash mantiqi (o'zgarmagan) — yangi nom bilan
create or replace function public.liga_final_qualifiers_std(p_code text, p_month text)
returns table(player_id uuid, name text, tops integer, month_xp integer)
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
revoke all on function public.liga_final_qualifiers_std(text, text) from public, anon, authenticated;

create or replace function public.liga_final_qualifiers(p_code text, p_month text)
returns table(player_id uuid, name text, tops integer, month_xp integer)
language sql stable security definer set search_path = public as $$
  select q.player_id, q.name, q.src_pos, q.xp from public.liga_gf_qualifiers(p_code) q
  where p_month = public.liga_gf_cfg('gf_month')
  union all
  select s.player_id, s.name, s.tops, s.month_xp from public.liga_final_qualifiers_std(p_code, p_month) s
  where p_month <> coalesce(public.liga_gf_cfg('gf_month'), '')
    and not (p_month = any(string_to_array(coalesce(public.liga_gf_cfg('gf_months'), ''), ',')))
$$;

create or replace function public.liga_final_date(p_month text)
returns date language sql stable security definer set search_path = public as $$
  select case when p_month = public.liga_gf_cfg('gf_month') then public.liga_gf_cfg('gf_date')::date
    else (select d from (select (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date e) x,
      lateral (select (e - ((extract(isodow from e)::int + 1) % 7))::date d) y) end
$$;

create or replace function public.liga_final_start(p_id uuid, p_token text, p_lang text DEFAULT 'uz'::text)
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
    if mm = public.liga_gf_cfg('gf_month') then
      -- Katta final: oktyabr–noyabr rejasining eng qiyin kunlaridan (8-daraja va yuqori), hammaga bir xil savollar
      q := public.liga_draw(array(select pool from public.liga_day_plan where level >= 8), 'gfinal|' || mm || '|' || g, 12, 0, 0, 8);
    end if;
    if coalesce(array_length(q, 1), 0) = 0 then
      q := public.liga_draw(public.liga_all_pools(), 'final|' || mm || '|' || g, 8, 6, 6, 0);
    end if;
    rid := public.liga_run_new('final', p_id, mm, null, p_lang, q);
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;

-- ilova uchun: Katta final poygasi (har kirishda eslatma va bosh sahifa kartasi)
create or replace function public.liga_grand_info(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (select public.liga_my_group(p_id) code),
  ms as (select unnest(string_to_array(public.liga_gf_cfg('gf_months'), ',')) m),
  cur as (select substr(public.liga_cur_week_id(), 1, 7) cm)
  select jsonb_build_object(
    'month', public.liga_gf_cfg('gf_month'),
    'date', public.liga_gf_cfg('gf_date'),
    'active', public.liga_today() <= public.liga_gf_cfg('gf_date')::date,
    'months', (select jsonb_agg(jsonb_build_object(
        'm', ms.m,
        'closed', (select cm from cur) > ms.m,
        'live', (select cm from cur) = ms.m,
        'top', coalesce((select jsonb_agg(jsonb_build_object('pos', r.pos, 'n', r.name, 'xp', r.xp, 'me', r.player_id = p_id) order by r.pos)
                         from public.liga_month_rank(g.code, ms.m) r where r.pos <= 3), '[]'::jsonb),
        'my_pos', (select r.pos from public.liga_month_rank(g.code, ms.m) r where r.player_id = p_id),
        'my_xp', coalesce((select r.xp from public.liga_month_rank(g.code, ms.m) r where r.player_id = p_id), 0),
        'third_xp', coalesce((select r.xp from public.liga_month_rank(g.code, ms.m) r where r.pos = 3), 0)
      ) order by ms.m) from ms, g),
    'qualifiers', coalesce((select jsonb_agg(jsonb_build_object('n', q.name, 'm', q.src_month, 'pos', q.src_pos, 'xp', q.xp, 'me', q.player_id = p_id))
                   from g, public.liga_gf_qualifiers(g.code) q), '[]'::jsonb),
    'qualified', exists (select 1 from g, public.liga_gf_qualifiers(g.code) q where q.player_id = p_id
                         and q.src_month < (select cm from cur))
  )
$$;
grant execute on function public.liga_grand_info(uuid) to anon, authenticated;
