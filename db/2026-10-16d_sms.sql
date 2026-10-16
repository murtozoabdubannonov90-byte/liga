-- 2026-10-16 · SMS eslatma (Eskiz.uz orqali): bosqichni bajarmaganlarga va kubok dueliga kirmaganlarga telefon raqamiga SMS.
-- Yoqish: liga_bot_config.sms_mode = 'on' (Eskiz login/paroli — edge secret ESKIZ_EMAIL / ESKIZ_PASSWORD).
-- Kunlik chegara: sms_cap (standart 400). Bir kishiga bir kunda bir turdagi SMS faqat bir marta.

create table if not exists public.liga_sms_log(
  id bigserial primary key,
  day date not null default public.liga_today(),
  kind text not null,                 -- stage | duel
  ref text not null default '',       -- duel kodi (stage uchun bo'sh)
  player_id uuid not null,
  phone text not null,
  status text not null default 'pending',  -- pending | sent | fail | skip
  provider_id text,
  err text,
  created_at timestamptz not null default now(),
  unique (day, kind, ref, player_id)
);
alter table public.liga_sms_log enable row level security;

-- navbatdagi SMSlar: chaqirilganda 'pending' qilib yoziladi va qaytariladi (takrorlanmaydi)
create or replace function public.liga_sms_due()
returns table(id bigint, kind text, phone text, lang text, ref text)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); h numeric := extract(hour from (now() at time zone 'Asia/Tashkent')) + extract(minute from (now() at time zone 'Asia/Tashkent')) / 60.0;
  cap int := coalesce((select value::int from public.liga_bot_config where key = 'sms_cap'), 400);
  used int; room int;
begin
  if coalesce((select value from public.liga_bot_config where key = 'sms_mode'), 'off') <> 'on' then return; end if;
  if extract(isodow from td) > 5 then return; end if;
  select count(*) into used from public.liga_sms_log l where l.day = td and l.status in ('pending', 'sent');
  room := cap - used; if room <= 0 then return; end if;

  -- 1) kubok dueli ochilganidan 5 daqiqa o'tib ham kirmagan o'yinchi (duel hali ochiq)
  insert into public.liga_sms_log(day, kind, ref, player_id, phone)
  select td, 'duel', x.code, x.pid, x.phone from (
    select l.code, p.id pid, p.phone
    from public.liga_day_duels d join public.liga_live l on l.code = d.code
    join public.safari_players p on p.id in (l.a_id, l.b_id)
    where d.day = td and l.status = 'wait' and l.win_from is not null
      and now() between l.win_from + interval '5 minutes' and l.win_to - interval '3 minutes'
      and coalesce(case when p.id = l.a_id then l.a_seen else l.b_seen end, '-infinity') < l.win_from
      and p.phone ~ '^\+998\d{9}$'
    limit room) x
  on conflict do nothing;
  select count(*) into used from public.liga_sms_log l where l.day = td and l.status in ('pending', 'sent'); room := cap - used;

  -- 2) 15:00 dan keyin bugungi bosqichni hali boshlamagan faol ishtirokchi (16:30 gacha)
  if h >= 15 and h < 16.5 and room > 0 then
    insert into public.liga_sms_log(day, kind, ref, player_id, phone)
    select td, 'stage', '', s.id, s.phone
    from public.safari_players s join public.liga_groups g on g.code = s.group_code
    where g.active and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id)
      and s.phone ~ '^\+998\d{9}$'
      and public.liga_stage_index(g.start_date, td) is not null
      and not exists (select 1 from public.liga_runs r where r.kind = 'stage' and r.player_id = s.id and (r.started_at at time zone 'Asia/Tashkent')::date = td)
    limit room
    on conflict do nothing;
  end if;

  return query
    select l.id, l.kind, l.phone, coalesce(p.lang, 'uz'), l.ref
    from public.liga_sms_log l join public.safari_players p on p.id = l.player_id
    where l.day = td and l.status = 'pending' and l.created_at > now() - interval '30 minutes'
    order by l.id;
end $$;

create or replace function public.liga_sms_mark(p_id bigint, p_status text, p_provider text, p_err text)
returns void language sql security definer set search_path = public as $$
  update public.liga_sms_log set status = p_status, provider_id = p_provider, err = left(p_err, 300) where id = p_id
$$;

-- oldindan ko'rish: hozir yoqilsa bugun qancha SMS ketardi
create or replace function public.liga_sms_preview()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mode', coalesce((select value from public.liga_bot_config where key = 'sms_mode'), 'off'),
    'cap', coalesce((select value::int from public.liga_bot_config where key = 'sms_cap'), 400),
    'today_sent', (select count(*) from public.liga_sms_log where day = public.liga_today() and status = 'sent'),
    'today_fail', (select count(*) from public.liga_sms_log where day = public.liga_today() and status = 'fail'),
    'stage_not_started', (select count(*) from public.safari_players s join public.liga_groups g on g.code = s.group_code
        where g.active and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id)
          and not exists (select 1 from public.liga_runs r where r.kind = 'stage' and r.player_id = s.id and (r.started_at at time zone 'Asia/Tashkent')::date = public.liga_today())),
    'duel_noshow_5d_avg', (select round(count(*) / 5.0) from public.liga_day_duels d join public.liga_live l on l.code = d.code
        where d.day > public.liga_today() - 5 and l.note in ('forfeit', 'cancel')))
$$;

revoke all on function public.liga_sms_due(), public.liga_sms_mark(bigint,text,text,text), public.liga_sms_preview() from public, anon, authenticated;
grant execute on function public.liga_sms_due(), public.liga_sms_mark(bigint,text,text,text), public.liga_sms_preview() to service_role;

insert into public.liga_bot_config(key, value) values ('sms_mode', 'off'), ('sms_cap', '400') on conflict (key) do nothing;

-- har 5 daqiqada (09:00–17:55 Toshkent, dushanba–juma)
do $$ begin
  perform cron.unschedule('liga-sms') where exists (select 1 from cron.job where jobname = 'liga-sms');
  perform cron.schedule('liga-sms', '*/5 4-12 * * 1-5', $c$select public.liga_bot_call('sms_tick')$c$);
end $$;
