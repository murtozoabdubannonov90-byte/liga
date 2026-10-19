-- 2026-10-19 (bazaga qo'llangan: ball_xatosi_va_kurs_2026_10_19, malumot_va_kirmaganlar_2026_10_19)
-- 1) XATO: juma 17:00 dan keyin ilovani ochganlarda o'tgan haftaning bosqich bali yangi haftada qolib ketardi
--    (liga_stage_cap bo'sh week_stages da hech narsa qilmasdi). Tuzatildi, 24 kishining bali 0 ga qaytarildi
--    (ularning o'tgan hafta natijasi liga_week_results da to'g'ri saqlangan — tekshirildi).
-- 2) Valyuta kursi: har kuni 12:00 (Toshkent); cbu.uz javob bermasa 12:20 va 12:40 da qayta. Ilovaga yangilangan vaqti ('upd').
-- 3) liga_info: «Buxgalter ma'lumotnomasi» bazada, haftalik yangilanadi (liga_info_set_sys). Ilova liga_info() ni o'qiydi.
-- 4) liga_player_kind: never (hech o'ynamagan) / away (2+ ish kuni o'ynamagan) / ok — bot eslatmalari va kunlik hisobot uchun.
create or replace function public.liga_stage_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; v int; tot int := 0; capped jsonb := '{}'::jsonb;
begin
  if new.week_stages is null or new.week_stages = '{}'::jsonb then
    new.week_stages := '{}'::jsonb; new.week_xp := 0; new.week_stage := 0;
    return new;
  end if;
  for k, v in select key, coalesce((value)::text::int,0) from jsonb_each(new.week_stages) loop
    v := greatest(0, least(v, 450));
    capped := capped || jsonb_build_object(k, v);
    tot := tot + v;
  end loop;
  new.week_stages := capped;
  new.week_xp := tot; new.week_stage := tot;
  return new;
end $$;

-- mavjud xato yozuvlar (o'tgan haftaning bali liga_week_results da to'g'ri saqlangan — tekshirildi)
update public.safari_players set week_stage = 0, week_xp = 0
 where (week_stages is null or week_stages = '{}'::jsonb) and (coalesce(week_stage,0) <> 0 or coalesce(week_xp,0) <> 0);

-- 2) Valyuta kursi: har kuni 12:00 (Toshkent) = 07:00 UTC. cbu.uz javob bermasa 12:20 va 12:40 da qayta urinadi.
create or replace function public.liga_rates()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ccy', ccy, 'rate', rate, 'diff', diff, 'date', rate_date,
           'upd', to_char(updated_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD"T"HH24:MI'))
         order by array_position(array['USD','EUR','RUB','CNY','KZT'], ccy)), '[]'::jsonb)
  from public.liga_rates where ccy in ('USD','EUR','RUB','CNY','KZT')
$$;
grant execute on function public.liga_rates() to anon, authenticated, service_role;

create or replace function public.liga_rates_tick()
returns bigint language plpgsql security definer set search_path = public as $$
declare t0 timestamptz := ((now() at time zone 'Asia/Tashkent')::date + time '11:55') at time zone 'Asia/Tashkent';
begin
  if exists (select 1 from public.liga_rates where updated_at >= t0) then return null; end if;   -- bugun yangilangan
  return public.liga_bot_call('rates');
end $$;
revoke all on function public.liga_rates_tick() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('liga-kurs') where exists (select 1 from cron.job where jobname = 'liga-kurs');
  perform cron.schedule('liga-kurs', '0,20,40 7 * * *', $c$select public.liga_rates_tick()$c$);
end $$;

-- 3) Ma'lumotnoma: butun bo'lim bitta JSON da ({updated, checked, items}). Haftalik yangilash — liga_info_set_sys.
create table if not exists public.liga_info(
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated date not null,          -- mazmun oxirgi marta o'zgargan sana
  checked date not null,          -- oxirgi tekshiruv sanasi (o'zgarish bo'lmasa ham)
  note text,
  changed_at timestamptz not null default now()
);
alter table public.liga_info enable row level security;

create or replace function public.liga_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('updated', to_char(updated, 'DD.MM.YYYY'), 'checked', to_char(checked, 'DD.MM.YYYY'), 'items', data)
  from public.liga_info where id = 1
$$;
grant execute on function public.liga_info() to anon, authenticated, service_role;

-- p_items null bo'lsa — faqat "tekshirildi" sanasi yangilanadi (o'zgarish topilmadi)
create or replace function public.liga_info_set_sys(p_items jsonb, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if p_items is not null and (jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 3) then raise exception 'bad_items'; end if;
  if p_items is null then
    update public.liga_info set checked = d, note = coalesce(p_note, note), changed_at = now() where id = 1;
  else
    insert into public.liga_info(id, data, updated, checked, note) values (1, p_items, d, d, p_note)
    on conflict (id) do update set
      updated = case when public.liga_info.data = excluded.data then public.liga_info.updated else d end,
      data = excluded.data, checked = d, note = coalesce(excluded.note, public.liga_info.note), changed_at = now();
  end if;
  return public.liga_info();
end $$;
revoke all on function public.liga_info_set_sys(jsonb, text) from public, anon, authenticated;

-- 4) Eslatmalar: never — hali birorta bosqich o'ynamagan; away — avval o'ynagan, lekin oxirgi 2 ish kunida o'ynamagan
create or replace function public.liga_player_kind(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  with r as (select max(started_at) last from public.liga_runs where kind = 'stage' and player_id = p_id)
  select case when r.last is null then 'never'
              when (select count(*) from generate_series(((r.last at time zone 'Asia/Tashkent')::date + 1), public.liga_today() - 1, interval '1 day') g
                     where extract(isodow from g) <= 5) >= 2 then 'away'
              else 'ok' end
  from r
$$;
revoke all on function public.liga_player_kind(uuid) from public, anon, authenticated;

create or replace function public.liga_morning_list3()
returns table(tg bigint, first_name text, lang text, stage integer, group_code text, kind text)
language sql stable security definer set search_path = public as $$
  select m.tg, m.first_name, m.lang, m.stage, m.group_code, public.liga_player_kind(s.id)
  from public.liga_morning_list() m join public.safari_players s on s.tg_user_id = m.tg
$$;
revoke all on function public.liga_morning_list3() from public, anon, authenticated;
grant execute on function public.liga_morning_list3() to service_role;

create or replace function public.liga_remind_list3()
returns table(tg bigint, first_name text, lang text, stage integer, group_code text, kind text)
language sql stable security definer set search_path = public as $$
  select m.tg, m.first_name, m.lang, m.stage, m.group_code, public.liga_player_kind(s.id)
  from public.liga_remind_list2() m join public.safari_players s on s.tg_user_id = m.tg
$$;
revoke all on function public.liga_remind_list3() from public, anon, authenticated;
grant execute on function public.liga_remind_list3() to service_role;

-- ilova uchun: o'yinchi hali birorta bosqich o'ynamaganmi (yangi a'zo kartasi)
create or replace function public.liga_my_kind(p_id uuid, p_token text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then return null; end if;
  return public.liga_player_kind(p_id);
end $$;
grant execute on function public.liga_my_kind(uuid, text) to anon, authenticated;

-- kunlik hisobotga: hech o'ynamaganlar va tashlab ketganlar soni
create or replace function public.liga_daily_report_kinds_sys(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  with k as (select s.id, (s.created_at at time zone 'Asia/Tashkent')::date reg, public.liga_player_kind(s.id) kind
             from public.safari_players s where coalesce(s.group_code,'ASOSIY') = p_code)
  select jsonb_build_object(
    'never', count(*) filter (where kind = 'never'),
    'never_old', count(*) filter (where kind = 'never' and reg < public.liga_today() - 1),
    'away', count(*) filter (where kind = 'away'))
  from k
$$;
revoke all on function public.liga_daily_report_kinds_sys(text) from public, anon, authenticated;

