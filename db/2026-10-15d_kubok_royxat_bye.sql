-- 2026-10-15 · Kubok ro'yxati: avtomatik o'tgan (juftsiz qolgan) o'yinchi ham o'z raundida ko'rinadi.
-- Avval ro'yxatda faqat duellar bor edi — toq sonda keyingi raundga o'tgan kishi hech qayerda ko'rinmasdi.
create or replace function public.liga_cup_list(p_id uuid)
returns table(round integer, stage text, slot text, a_name text, b_name text, a_pts integer, b_pts integer, status text, note text, mine boolean, winner_name text, champion text)
language plpgsql security definer set search_path = public as $$
declare g text := public.liga_my_group(p_id); ch text;
begin
  perform public.liga_cup_try_advance(g);
  select trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) into ch from public.liga_day_cups c join public.safari_players p on p.id = c.champion
    where c.day = public.liga_today() and c.group_code = g;
  return query select z.round, z.stage, z.slot, z.a_name, z.b_name, z.a_pts, z.b_pts, z.status, z.note, z.mine, z.winner_name, ch from (
    select d.round, public.liga_cup_rstage(d.day, d.group_code, d.round) stage, to_char(d.slot, 'HH24:MI') slot,
      public.liga_pname(d.a_id) a_name, public.liga_pname(d.b_id) b_name, l.a_pts, l.b_pts, l.status, l.note, p_id in (d.a_id, d.b_id) mine,
      public.liga_pname(d.winner) winner_name, d.pos, 0 bye
    from public.liga_day_duels d join public.liga_live l on l.code = d.code
    where d.day = public.liga_today() and d.group_code = g
    union all
    select b.round, public.liga_cup_rstage(b.day, b.group_code, b.round),
      coalesce((select to_char(min(x.slot), 'HH24:MI') from public.liga_day_duels x where x.day = b.day and x.group_code = b.group_code and x.round = b.round), ''),
      public.liga_pname(b.player_id), null::text, 0, 0, 'bye'::text, 'bye'::text, b.player_id = p_id, public.liga_pname(b.player_id), b.pos, 1
    from public.liga_day_byes b
    where b.day = public.liga_today() and b.group_code = g) z
  order by z.round, z.bye, z.pos;
end $$;
