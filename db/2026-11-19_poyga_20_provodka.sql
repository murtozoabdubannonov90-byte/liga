-- 2026-11-19: Provodka poygasi (guruh dueli, 2–10 kishi) — oxirgi 5 ta savol o'rniga ham provodka: 20 ta provodka.
-- Avval: 15 ta provodka + 5 ta boshqa savol (mc/calc).
create or replace function public.liga_quad_draw(p_seed text, p_players uuid[])
returns text[] language sql stable security definer set search_path = public as $$
  with seen as (select qid from public.liga_seen_week(p_players)), pools as (select public.liga_quad_pools() p)
  select coalesce((select array_agg(id order by md5(id || p_seed || 't')) from (
            select id from public.liga_bank, pools where pool = any(pools.p) and active and t = 'pv'
            order by (id in (select qid from seen)), md5(id || p_seed) limit 20) a), '{}')
$$;
