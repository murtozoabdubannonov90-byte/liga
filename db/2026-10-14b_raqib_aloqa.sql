-- 2026-10-14 · Kunlik duel kubogi: raqib ustiga bosilsa — telefon raqami va Telegram niki chiqadi.
-- Sabab: a'zolar duelga kirmayapti — raqib unga o'zi qo'ng'iroq qilsin yoki yozsin.
-- Telegram niki bot orqali yig'iladi: botga yozganda / ilovani Telegram ichida ochganda saqlanadi,
-- eskilari esa bot tomonidan getChat orqali bir martalik to'ldiriladi (tg_names amali).

alter table public.safari_players add column if not exists tg_username text;
alter table public.safari_players add column if not exists tg_checked_at timestamptz;

-- bot: foydalanuvchi har gal yozganda niki yangilanadi (nik o'zgarsa ham, o'chirilsa ham)
create or replace function public.liga_tg_seen_sys(p_tg bigint, p_username text)
returns void language sql security definer set search_path = public as $$
  update public.safari_players
     set tg_username = nullif(trim(both '@' from coalesce(p_username, '')), ''), tg_checked_at = now()
   where tg_user_id = p_tg
     and (tg_username is distinct from nullif(trim(both '@' from coalesce(p_username, '')), '') or tg_checked_at is null);
$$;

-- bot: niki hali aniqlanmagan Telegram bog'langan o'yinchilar (getChat bilan to'ldirish uchun)
create or replace function public.liga_tg_unknown_sys(p_limit int default 200)
returns table(tg bigint) language sql security definer set search_path = public as $$
  select distinct s.tg_user_id from public.safari_players s
   where s.tg_user_id is not null and s.tg_username is null
     and (s.tg_checked_at is null or s.tg_checked_at < now() - interval '3 days')
   limit greatest(1, least(p_limit, 500));
$$;

-- ilova: duel raqibining aloqa ma'lumotlari. Faqat o'sha kubok duelining ishtirokchisiga (token bilan).
create or replace function public.liga_duel_opp_contact(p_id uuid, p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.liga_live; o uuid; s public.safari_players;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into l from public.liga_live where code = upper(trim(p_code));
  if l.code is null or p_id not in (l.a_id, coalesce(l.b_id, l.a_id)) then raise exception 'not_found'; end if;
  if not exists (select 1 from public.liga_day_duels d where d.code = l.code) then raise exception 'not_found'; end if;
  o := case when l.a_id = p_id then l.b_id else l.a_id end;
  if o is null then return null; end if;
  select * into s from public.safari_players where id = o;
  if s.id is null then return null; end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'name', trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')),
    'phone', nullif(s.phone, ''),
    'tg', s.tg_username,
    'tg_id', s.tg_user_id,
    'region', s.region));
end $$;

revoke all on function public.liga_tg_seen_sys(bigint, text) from public, anon, authenticated;
revoke all on function public.liga_tg_unknown_sys(int) from public, anon, authenticated;
grant execute on function public.liga_tg_seen_sys(bigint, text) to service_role;
grant execute on function public.liga_tg_unknown_sys(int) to service_role;
revoke all on function public.liga_duel_opp_contact(uuid, text, text) from public;
grant execute on function public.liga_duel_opp_contact(uuid, text, text) to anon, authenticated, service_role;
