-- 2026-11-04: kubok e'loni va qulf kutishlari
-- 1) Kubok cron'i 17:55 da to'xtardi, final 17:56 da tugasa chempion e'lon qilinmasdi (02.11).
--    Endi 18:55 gacha ishlaydi (UTC 4-13).
select cron.alter_job(10, schedule := '*/5 4-13 * * 1-5');

-- 2) liga_live_state: duel qatori band bo'lsa kutmaydi (statement timeout -> 500 edi),
--    joriy holatni qaytaradi; keyingi so'rovda yangilanadi.
create or replace function public.liga_live_state(p_id uuid, p_token text, p_code text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare d public.liga_live; c text := upper(trim(p_code));
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into d from public.liga_live where code = c for update skip locked;
  if d.code is null then
    if exists (select 1 from public.liga_live where code = c) then
      return public.liga_live_view2(c, p_id);
    end if;
    raise exception 'not_found';
  end if;
  if d.a_id = p_id then update public.liga_live set a_seen = now() where code = c;
  elsif d.b_id = p_id then update public.liga_live set b_seen = now() where code = c;
  elsif d.b_id is null then
    if d.created_at < now() - interval '2 days' then raise exception 'duel_expired'; end if;
    if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
    update public.liga_live set b_id = p_id, b_seen = now() where code = c;
  end if;
  perform public.liga_live_tick(c);
  return public.liga_live_view2(c, p_id);
end $function$;

-- 3) liga_cup_try_advance (faqat ilova chaqiradi: liga_cup_list, liga_day_duel_me):
--    qulf 1,5 s da bo'shamasa — o'tkazib yuboradi, cron (har 2 daqiqa) baribir suradi.
create or replace function public.liga_cup_try_advance(p_group text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare lt text := current_setting('lock_timeout');
begin
  if pg_try_advisory_xact_lock(hashtext('liga_cup|' || p_group)) then
    begin
      perform set_config('lock_timeout', '1500ms', true);
      perform public.liga_cup_advance(p_group);
      perform set_config('lock_timeout', lt, true);
    exception when lock_not_available then
      null;
    end;
  end if;
end $function$;
