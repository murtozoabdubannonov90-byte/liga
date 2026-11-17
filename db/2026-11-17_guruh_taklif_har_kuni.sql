-- 2026-11-17: guruhga qo'shilmaganlarga taklif — har kuni 1 marta, dushanba–shanba, qo'shilguncha
-- Avval: 3 kunda bir, jami ko'pi 3 marta, faqat ish kunlari. Endi: Toshkent vaqti bo'yicha bugun hali yuborilmagan
-- har bir 'sent' holatidagi o'yinchiga (botni bloklagan 'fail', chiqarilgan 'kicked', guruhdagi 'in' — olinmaydi).
-- Yuboruvchi: Edge Function `liga-taklif` (bot/taklif.ts). O'chirish: update liga_bot_config set value='off' where key='discuss_resend_on';

create or replace function public.liga_discuss_resend_pick_sys(p_limit integer)
returns table(tg bigint, lang text, first_name text, n integer)
language plpgsql security definer set search_path = public as $$
declare v_day timestamptz := date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent';
begin
  return query
  with c as (
    select s.tg_user_id, max(s.last_active) la from public.safari_players s
     where s.tg_user_id is not null and s.discuss_status = 'sent'
       and s.discuss_sent_at < v_day
     group by s.tg_user_id
     order by max(s.last_active) desc nulls last
     limit greatest(1, least(p_limit, 100))
  )
  update public.safari_players s
     set discuss_sent_at = now(), discuss_resends = s.discuss_resends + 1
    from c
   where s.tg_user_id = c.tg_user_id
     and s.discuss_status = 'sent'
     and s.discuss_sent_at < v_day
  returning s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name, s.discuss_resends;
end $$;
revoke all on function public.liga_discuss_resend_pick_sys(integer) from public, anon, authenticated;
grant execute on function public.liga_discuss_resend_pick_sys(integer) to service_role;

-- sinov uchun: bugun nechta odamga yuboriladi (hech narsa o'zgartirmaydi)
create or replace function public.liga_discuss_resend_count_sys()
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct s.tg_user_id)::int from public.safari_players s
   where s.tg_user_id is not null and s.discuss_status = 'sent'
     and s.discuss_sent_at < date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent';
$$;
revoke all on function public.liga_discuss_resend_count_sys() from public, anon, authenticated;
grant execute on function public.liga_discuss_resend_count_sys() to service_role;

-- cron: dushanba–shanba 10:00–18:50 Toshkent (05–13 UTC), har 10 daqiqada (har chaqiruvda 40 kishigacha)
select cron.alter_job(jobid, schedule := '*/10 5-13 * * 1-6') from cron.job where jobname = 'liga-guruh-qayta';
