-- Sovrinli musobaqa: har 2 soatda (10:00, 12:00, 14:00, 16:00) guruhga e'lon va shaxsiy xabar.
-- Shaxsiy: to'lov qilmaganlarga — taklif ('join'); to'lagan, lekin bugun o'yinni tugatmaganlarga — eslatma ('play').
-- Chek tekshirilayotganlar va bugun o'ynab bo'lganlarga yuborilmaydi.
create or replace function public.liga_px_promo_list_sys(p_after bigint, p_limit integer default 80)
returns table(tg_user_id bigint, first_name text, lang text, kind text)
language sql stable security definer set search_path to 'public' as $$
  select x.tg_user_id, x.first_name, x.lang, x.kind from (
    select s.tg_user_id, s.first_name, s.lang,
           case when public.liga_px_paid(s.id) then
                  case when coalesce(public.liga_px_day_state(s.id)->>'state', 'none') = 'done' then null else 'play' end
                when public.liga_px_pay_state(s.id) in ('none', 'cancelled') then 'join' end kind
      from public.safari_players s
     where s.tg_user_id is not null and s.tg_user_id > coalesce(p_after, 0)
     order by s.tg_user_id limit p_limit) x
$$;
revoke all on function public.liga_px_promo_list_sys(bigint, integer) from public, anon, authenticated;
grant execute on function public.liga_px_promo_list_sys(bigint, integer) to service_role;

-- cron: Toshkent 10:00, 12:00, 14:00, 16:00 (UTC 05, 07, 09, 11), har slotda 6 daqiqa × 80 kishi
select cron.schedule('liga-musobaqa-2soat', '0-5 5,7,9,11 * * *', $c$select public.liga_bot_call('px_promo')$c$);
