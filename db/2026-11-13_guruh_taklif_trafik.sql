-- 2026-11-13: muhokama guruhiga taklif (ilovada) va trafikni tejash
-- 1) liga_discuss_me — ilova uchun: guruh havolasi va o'yinchi guruhda bormi (discuss_status = 'in').
--    Holat bot orqali yangilanadi (getChatMember): har ish kuni 08:40 da `discuss_check` (pastdagi cron).
create or replace function public.liga_discuss_me(p_id uuid, p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_link text; v_st text;
begin
  if not public.liga_auth(p_id, p_token) then return null; end if;
  select value into v_link from public.liga_bot_config where key = 'discuss_link';
  if v_link is null then return null; end if;
  select discuss_status into v_st from public.safari_players where id = p_id;
  return json_build_object('link', v_link, 'in', coalesce(v_st, '') = 'in', 'tg', exists (select 1 from public.safari_players where id = p_id and tg_user_id is not null));
end $$;
revoke all on function public.liga_discuss_me(uuid, text) from public;
grant execute on function public.liga_discuss_me(uuid, text) to anon, authenticated, service_role;

-- 2) guruhga qo'shilganlar holatini har ish kuni ertalab tekshirish (08:40 Toshkent = 03:40 UTC)
select cron.unschedule('liga-guruh-holat') where exists (select 1 from cron.job where jobname = 'liga-guruh-holat');
select cron.schedule('liga-guruh-holat', '40 3 * * 1-5', $$select public.liga_bot_call('discuss_check')$$);

-- 3) Sovrinli musobaqa vaqtincha olib tashlandi — uning e'lon/taklif cronlari to'xtatiladi (o'chirilmaydi).
--    Qayta yoqish: select cron.alter_job(jobid, active := true) from cron.job where jobname like 'liga-musobaqa%' or jobname like 'liga-mashq-%';
select cron.alter_job(jobid, active := false) from cron.job
 where jobname in ('liga-musobaqa-2soat', 'liga-musobaqa-elon', 'liga-musobaqa-taklif-1', 'liga-musobaqa-taklif-2', 'liga-mashq-elon');
