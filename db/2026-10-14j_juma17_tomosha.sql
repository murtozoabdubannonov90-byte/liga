-- 2026-10-14 · 1) Juma kuni ham bosqich 09:00–17:00 (avval 12:00 gacha edi). Haftalik liga juma 17:00 da yakunlanadi.
--              Hafta identifikatori (week_id) yozuvi o'zgarmaydi ("YYYY-MM-DDT07:00" — juma sanasi), faqat almashish payti 12:00 → 17:00 (Toshkent).
--              2) Guruhdagi jonli duel: har savoldan keyin guruhdagi xabar yangilanadi — tomoshabinlar hisob, savol va to'g'ri javobni ko'radi.

create or replace function public.liga_close_hour(d date)
returns integer language sql immutable as $$ select 17 $$;

create or replace function public.liga_cur_week_id()
returns text language sql stable as $$
  select to_char(case when b <= (now() at time zone 'UTC') then b + interval '7 days' else b end - interval '5 hours', 'YYYY-MM-DD"T"HH24:MI')
  from (select date_trunc('week', now() at time zone 'UTC') + interval '4 days 12 hours' as b) x
$$;

create or replace function public.liga_last_week_id()
returns text language sql stable set search_path = public as $$
  select to_char(case when b > (now() at time zone 'UTC') then b - interval '7 days' else b end - interval '5 hours', 'YYYY-MM-DD"T"HH24:MI')
  from (select date_trunc('week', now() at time zone 'UTC') + interval '4 days 12 hours' as b) x
$$;

-- juma jadvali: ogohlantirish 16:00, liga yakuni 17:01, darajalar 17:10 (Toshkent)
select cron.schedule('liga-juma-11', '0 11 * * 5', 'select public.liga_bot_call(''friday_warn'')');
select cron.schedule('liga-tugadi', '1 12 * * 5', 'select public.liga_bot_call(''league_end'')');
select cron.schedule('liga-darajalar', '10 12 * * 5', 'select public.liga_bot_call(''tiers'')');

-- botni qo'shimcha ma'lumot bilan chaqirish
create or replace function public.liga_bot_call2(p_action text, p_extra jsonb)
returns bigint language plpgsql security definer set search_path = public, extensions, net as $$
declare k text; rid bigint;
begin
  select value into k from public.liga_bot_config where key = 'cron_key';
  select net.http_post(
    url := 'https://bopzjxboembvcqycfwin.supabase.co/functions/v1/liga-bot',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-key', k),
    body := jsonb_build_object('action', p_action) || coalesce(p_extra, '{}'::jsonb),
    timeout_milliseconds := 20000) into rid;
  return rid;
end $$;
revoke all on function public.liga_bot_call2(text, jsonb) from public, anon, authenticated;

-- guruhdagi duel o'zgarsa (qabul qilindi, boshlandi, savol almashdi, ochko) — bot xabarni yangilaydi
create or replace function public.liga_live_group_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.cur is distinct from old.cur or new.status is distinct from old.status or new.a_pts is distinct from old.a_pts
      or new.b_pts is distinct from old.b_pts or new.b_id is distinct from old.b_id)
     and exists (select 1 from public.liga_group_posts g where g.code = new.code and not g.posted) then
    perform public.liga_bot_call2('group_live', jsonb_build_object('code', new.code));
  end if;
  return new;
end $$;
create or replace trigger liga_live_group_notify after update on public.liga_live
  for each row execute function public.liga_live_group_notify();

-- bot: tomoshabin ko'rinishi (o'yinchilarga tegishli maxfiy narsa yo'q: joriy savol javobi ko'rsatilmaydi, faqat o'tgani)
create or replace function public.liga_group_live_sys(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.liga_group_posts; v jsonb;
begin
  select * into g from public.liga_group_posts where code = upper(trim(p_code));
  if g.code is null or g.posted then return null; end if;
  v := public.liga_live_view(g.code, null);
  return (v - 'item' - 'log') || jsonb_build_object('chat_id', g.chat_id, 'msg_id', g.msg_id);
end $$;
revoke all on function public.liga_group_live_sys(text) from public, anon, authenticated;
grant execute on function public.liga_group_live_sys(text) to service_role;
