-- Sovrinli musobaqa: ishtirokchilar soni faqat egasiga (free_phones dagi telefon) ko'rinadi.
-- Boshqa o'yinchilarga null qaytadi — ilova hech narsa ko'rsatmaydi.
create or replace function public.liga_px_owner(p_id uuid, p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_mon text := public.liga_px_mon(); d date := public.liga_today(); t0 timestamptz := public.liga_px_t0();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not exists (select 1 from public.safari_players s where s.id = p_id
                   and s.phone = any(string_to_array(coalesce((select value from public.liga_bot_config where key = 'free_phones'), ''), ','))) then
    return null;
  end if;
  return jsonb_build_object(
    'paid',   (select count(distinct p.player_id) from public.liga_px_pay p where p.mon = v_mon and p.status = 'paid'),
    'check',  (select count(distinct p.player_id) from public.liga_px_pay p where p.mon = v_mon and p.status = 'check'),
    'today',  (select count(distinct x.player_id) from public.liga_px_sess x where x.day = d and x.done_n > 0 and x.started_at >= t0),
    'month',  (select count(distinct x.player_id) from public.liga_px_sess x where x.mon = v_mon and x.done_n > 0 and x.started_at >= t0));
end $$;
revoke all on function public.liga_px_owner(uuid, text) from public;
grant execute on function public.liga_px_owner(uuid, text) to anon, authenticated;
