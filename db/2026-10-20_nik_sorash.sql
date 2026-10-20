-- 2026-10-20 · Telegram niki (username) yo'q ishtirokchilardan bot nik qo'yishni so'raydi.
-- Sabab: kubok duelida raqib ustiga bosilganda Telegram niki chiqadi — niki yo'qlarga yozib bo'lmaydi.
-- Bot: ish kunlari 13:00 da (Toshkent) niki yo'qlarga shaxsan yo'riqnoma + «Nik qo'ydim — tekshirish» tugmasi.
-- Bir odamga ko'pi bilan 4 marta, kamida 2 kun oraliq bilan. Nik qo'yilgach so'rash to'xtaydi.

alter table public.safari_players add column if not exists nick_asked_at timestamptz;
alter table public.safari_players add column if not exists nick_asks int not null default 0;

create or replace function public.liga_nick_ask_list_sys(p_limit int default 500)
returns table(tg bigint, first_name text, lang text, asks int)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, coalesce(s.lang, 'uz'), s.nick_asks
    from public.safari_players s
   where s.tg_user_id is not null and s.tg_username is null
     and s.nick_asks < 4
     and (s.nick_asked_at is null or s.nick_asked_at < now() - interval '47 hours')
   order by s.nick_asks, s.created_at
   limit greatest(1, least(p_limit, 1000));
$$;

create or replace function public.liga_nick_asked_sys(p_tg bigint)
returns void language sql security definer set search_path = public as $$
  update public.safari_players set nick_asked_at = now(), nick_asks = nick_asks + 1 where tg_user_id = p_tg;
$$;

-- kunlik hisobot uchun
create or replace function public.liga_nick_stats_sys(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'no_nick', count(*) filter (where tg_user_id is not null and tg_username is null),
    'asked', count(*) filter (where tg_user_id is not null and tg_username is null and nick_asks > 0),
    'set_after_ask', count(*) filter (where tg_username is not null and nick_asks > 0))
  from public.safari_players where coalesce(group_code, 'ASOSIY') = p_code
$$;

revoke all on function public.liga_nick_ask_list_sys(int), public.liga_nick_asked_sys(bigint), public.liga_nick_stats_sys(text) from public, anon, authenticated;
grant execute on function public.liga_nick_ask_list_sys(int), public.liga_nick_asked_sys(bigint), public.liga_nick_stats_sys(text) to service_role;

do $$ begin
  perform cron.unschedule('liga-nik') where exists (select 1 from cron.job where jobname = 'liga-nik');
  perform cron.schedule('liga-nik', '0 8 * * 1-5', $c$select public.liga_bot_call('nick_ask')$c$);
end $$;
