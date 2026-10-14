-- 2026-10-14 · Bot kubok xabarlarida (juftlik e'loni, yangi bosqich, 5 daqiqa qoldi, duel boshlandi)
-- raqibning telefon raqami va Telegram niki ham yoziladi. Faqat bot (service_role) chaqiradi.
create or replace function public.liga_duel_opp_contact_sys(p_code text, p_tg bigint)
returns table(phone text, tg_username text) language sql security definer set search_path = public as $$
  select nullif(o.phone, ''), o.tg_username
    from public.liga_live l
    join public.safari_players me on me.tg_user_id = p_tg and me.id in (l.a_id, l.b_id)
    join public.safari_players o on o.id = case when l.a_id = me.id then l.b_id else l.a_id end
   where l.code = upper(trim(p_code))
     and exists (select 1 from public.liga_day_duels d where d.code = l.code)
   limit 1;
$$;
revoke all on function public.liga_duel_opp_contact_sys(text, bigint) from public, anon, authenticated;
grant execute on function public.liga_duel_opp_contact_sys(text, bigint) to service_role;
