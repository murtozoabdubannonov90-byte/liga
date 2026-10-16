-- 2026-10-16 · 1) AI (Gemini, Jarvis va h.k.) bilan yechishni nazorat: savol paytida ilovadan / oynadan har bir chiqish serverga yoziladi
--                 (qisqasi ham). Admin bosh sahifada kim necha marta chiqqanini va nechta savol shu sababli xato bo'lganini ko'radi.
--              2) Markaziy bank valyuta kurslari (bot har soatda cbu.uz dan oladi) — bosh sahifada sana bilan.

create table if not exists public.liga_away(
  id bigserial primary key,
  player_id uuid,
  day date not null default public.liga_today(),
  kind text not null,          -- stage | final | duel | live
  ref text,                    -- run id yoki duel kodi
  k int,
  ms int not null,
  at timestamptz not null default now()
);
create index if not exists liga_away_day_player on public.liga_away(day, player_id);
create index if not exists liga_away_ref on public.liga_away(ref);
alter table public.liga_away enable row level security;

create or replace function public.liga_run_away(p_run uuid, p_id uuid, p_token text, p_secret text, p_k int, p_ms int)
returns void language plpgsql security definer set search_path = public as $$
declare r public.liga_runs;
begin
  r := public.liga_run_auth(p_run, p_id, p_token, p_secret);
  if r.kind = 'test' then return; end if;
  if (select count(*) from public.liga_away where ref = p_run::text) >= 300 then return; end if;
  insert into public.liga_away(player_id, kind, ref, k, ms) values (r.player_id, r.kind, p_run::text, p_k, least(greatest(coalesce(p_ms, 0), 0), 3600000));
end $$;

create or replace function public.liga_live_away(p_id uuid, p_token text, p_code text, p_k int, p_ms int)
returns void language plpgsql security definer set search_path = public as $$
declare d public.liga_live;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_live where code = upper(trim(p_code));
  if d.code is null or p_id not in (d.a_id, coalesce(d.b_id, p_id)) then return; end if;
  if (select count(*) from public.liga_away where ref = d.code) >= 300 then return; end if;
  insert into public.liga_away(player_id, kind, ref, k, ms) values (p_id, 'live', d.code, p_k, least(greatest(coalesce(p_ms, 0), 0), 3600000));
end $$;

revoke all on function public.liga_run_away(uuid,uuid,text,text,int,int), public.liga_live_away(uuid,text,text,int,int) from public;
grant execute on function public.liga_run_away(uuid,uuid,text,text,int,int), public.liga_live_away(uuid,text,text,int,int) to anon, authenticated, service_role;

-- admin: bugun savol paytida ilovadan chiqqanlar
create or replace function public.liga_admin_away(p_pin text)
returns table(name text, phone text, away_n int, away_s int, lost_n int, right_n int, done_n int, med_s numeric)
language plpgsql stable security definer set search_path = public as $$
declare g text; r text := public.liga_pin_role(p_pin); td date := public.liga_today();
begin
  if r = 'admin' then select code into g from public.liga_groups where admin_pin = p_pin;
  elsif r = 'super' then g := 'ASOSIY';
  else return; end if;
  return query
  with aw as (select a.player_id, count(*)::int n, (sum(a.ms) / 1000)::int s from public.liga_away a where a.day = td group by a.player_id),
  an as (select x.player_id, count(*) filter (where y.why = 'left')::int lost, count(*) filter (where y.ok)::int ok, count(*)::int done,
                round((percentile_cont(0.5) within group (order by extract(epoch from y.answered_at - y.shown_at)))::numeric, 0) med
         from public.liga_runs x join public.liga_run_ans y on y.run_id = x.id
         where x.kind = 'stage' and (x.started_at at time zone 'Asia/Tashkent')::date = td and y.answered_at is not null group by x.player_id)
  select trim(coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')), s.phone, coalesce(aw.n, 0), coalesce(aw.s, 0),
         coalesce(an.lost, 0), coalesce(an.ok, 0), coalesce(an.done, 0), an.med
  from public.safari_players s left join aw on aw.player_id = s.id left join an on an.player_id = s.id
  where s.group_code = g and (coalesce(aw.n, 0) > 0 or coalesce(an.lost, 0) > 0)
  order by coalesce(an.lost, 0) desc, coalesce(aw.n, 0) desc;
end $$;
revoke all on function public.liga_admin_away(text) from public;
grant execute on function public.liga_admin_away(text) to anon, authenticated, service_role;

-- valyuta kurslari
create table if not exists public.liga_rates(
  ccy text primary key,
  rate numeric not null,
  diff numeric,
  rate_date date not null,
  updated_at timestamptz not null default now()
);
alter table public.liga_rates enable row level security;
create or replace function public.liga_rates()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ccy', ccy, 'rate', rate, 'diff', diff, 'date', rate_date) order by array_position(array['USD','EUR','RUB','CNY','KZT'], ccy)), '[]'::jsonb)
  from public.liga_rates where ccy in ('USD','EUR','RUB','CNY','KZT')
$$;
grant execute on function public.liga_rates() to anon, authenticated, service_role;

do $$ begin
  perform cron.unschedule('liga-kurs') where exists (select 1 from cron.job where jobname = 'liga-kurs');
  perform cron.schedule('liga-kurs', '7 * * * *', $c$select public.liga_bot_call('rates')$c$);
end $$;
