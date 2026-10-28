-- 2026-10-28b: 4 kishilik duel natijasi har bir o'yinchiga SHAXSAN bot orqali yuboriladi (guruhga yuborilmaydi).
-- Duel yakunlanganda (status → done, o'yin boshlangan bo'lsa) trigger botga 'quad_done' yuboradi;
-- bot liga_quad_result_sys orqali natijani bir marta oladi (notified_at) va Telegram ulangan o'yinchilarga yozadi.

alter table public.liga_quad add column if not exists notified_at timestamptz;

-- natija (bir marta: ikkinchi chaqiruvda null) — faqat bot (service role) uchun
create or replace function public.liga_quad_result_sys(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(p_code)); d public.liga_quad; tie boolean;
begin
  update public.liga_quad set notified_at = now()
    where code = c and status = 'done' and started_at is not null and notified_at is null
    returning * into d;
  if d.code is null then return null; end if;
  select count(*) > 1 into tie from public.liga_quad_p
    where code = c and (pts, ms) = (select pts, ms from public.liga_quad_p where code = c order by pts desc, ms limit 1);
  return jsonb_build_object('code', c, 'note', d.note, 'n', coalesce(array_length(d.qids, 1), 20), 'tie', tie,
    'players', (select jsonb_agg(jsonb_build_object('place', r.pos, 'name', public.liga_pname(r.pid), 'pts', r.pts, 'ms', r.ms,
                  'tg', s.tg_user_id, 'lang', s.lang) order by r.pos)
                from (select pid, pts, ms, row_number() over (order by pts desc, ms, seat) pos from public.liga_quad_p where code = c) r
                join public.safari_players s on s.id = r.pid));
end $$;
revoke all on function public.liga_quad_result_sys(text) from public, anon, authenticated;

create or replace function public.liga_quad_done_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.started_at is not null then
    perform public.liga_bot_call2('quad_done', jsonb_build_object('code', new.code));
  end if;
  return new;
end $$;
revoke all on function public.liga_quad_done_trg() from public, anon, authenticated;
drop trigger if exists liga_quad_done on public.liga_quad;
create trigger liga_quad_done after update of status on public.liga_quad
  for each row execute function public.liga_quad_done_trg();
