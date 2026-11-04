-- 2026-11-04c: Provodka poygasi (guruh dueli, 2–10 kishi) natijasi guruh(lar)ga ham chiqadi.
-- liga_quad_result_sys javobiga 'group' (xona egasining jamoasi) qo'shildi; bot quadDone shu jamoaning faol guruhlariga yuboradi.
create or replace function public.liga_quad_result_sys(p_code text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare c text := upper(trim(p_code)); d public.liga_quad; tie boolean;
begin
  update public.liga_quad set notified_at = now()
    where code = c and status = 'done' and started_at is not null and notified_at is null
    returning * into d;
  if d.code is null then return null; end if;
  select count(*) > 1 into tie from public.liga_quad_p
    where code = c and (pts, ms) = (select pts, ms from public.liga_quad_p where code = c order by pts desc, ms limit 1);
  return jsonb_build_object('code', c, 'note', d.note, 'n', coalesce(array_length(d.qids, 1), 20), 'tie', tie,
    'group', (select s.group_code from public.safari_players s where s.id = d.host),
    'players', (select jsonb_agg(jsonb_build_object('place', r.pos, 'name', public.liga_pname(r.pid), 'pts', r.pts, 'ms', r.ms,
                  'tg', s.tg_user_id, 'lang', s.lang) order by r.pos)
                from (select pid, pts, ms, row_number() over (order by pts desc, ms, seat) pos from public.liga_quad_p where code = c) r
                join public.safari_players s on s.id = r.pid));
end $function$;
