-- 2026-10-15 · Xatolar tuzatildi:
-- 1) Guruhdagi duel havolasini ochgan tomoshabinlarga ham savol va javob tugmasi chiqib, ular javob bossa «duel_taken» xatosi chiqardi
--    (bugun 34 marta). Endi joriy savol faqat duel ishtirokchilariga yuboriladi; tomoshabin hisob va o'tgan savolni ko'radi.
-- 2) 11:20 da raund almashganda har bir o'yinchining so'rovi kubok qulfini kutib qoldi va bittasi vaqt tugashi bilan uzildi.
--    Endi qulf band bo'lsa so'rov kutmaydi — raundni cron (har 2 daqiqada) baribir tuzadi.

create or replace function public.liga_live_view(p_code text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.liga_live; side text; b public.liga_bank; pb public.liga_bank; last jsonb; an text; bn text; win text;
begin
  select * into d from public.liga_live where code = p_code;
  if d.code is null then raise exception 'not_found'; end if;
  side := case when p_id = d.a_id then 'a' when p_id = d.b_id then 'b' end;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into an from public.safari_players where id = d.a_id;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into bn from public.safari_players where id = d.b_id;
  -- joriy savol — faqat o'yinchilarga (tomoshabin javob bera olmaydi va o'yinchiga aytib bera olmaydi)
  if side is not null and d.status = 'play' and now() >= d.q_at then select * into b from public.liga_bank where id = d.qids[d.cur + 1]; end if;
  if d.cur > 0 then
    select * into pb from public.liga_bank where id = d.qids[d.cur];
    last := jsonb_build_object('k', d.cur - 1, 'w', d.log -> (d.cur - 1) -> 'w', 'q', (case when d.lang = 'ru' then pb.ru else pb.uz end) ->> 'q',
      't', pb.t, 'o', case when pb.t = 'mc' then (case when d.lang = 'ru' then pb.ru else pb.uz end) -> 'o' end) || public.liga_q_reveal(pb, d.lang);
  end if;
  if d.status = 'done' then
    win := case when d.a_pts > d.b_pts then 'a' when d.b_pts > d.a_pts then 'b' when d.a_ms < d.b_ms then 'a' when d.b_ms < d.a_ms then 'b' else 'tie' end;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'code', d.code, 'status', d.status, 'me', side, 'a_name', an, 'b_name', bn, 'a_pts', d.a_pts, 'b_pts', d.b_pts,
    'a_ms', d.a_ms, 'b_ms', d.b_ms, 'n', array_length(d.qids, 1), 'cur', d.cur, 'qsec', public.liga_live_qsec(),
    'spectator', side is null and d.b_id is not null,
    'q_in', case when d.status = 'play' then greatest(0, extract(epoch from (d.q_at - now())) * 1000)::int end,
    'left', case when d.status = 'play' and now() >= d.q_at then greatest(0, extract(epoch from (d.q_at + make_interval(secs => public.liga_live_qsec()) - now())) * 1000)::int end,
    'item', case when b.id is not null then public.liga_q_pub(b, d.lang) || jsonb_build_object('k', d.cur) end,
    'locked', case side when 'a' then d.a_lock = d.cur when 'b' then d.b_lock = d.cur end,
    'opp_locked', case side when 'a' then d.b_lock = d.cur when 'b' then d.a_lock = d.cur end,
    'opp_here', case side when 'a' then d.b_seen > now() - interval '5 seconds' when 'b' then d.a_seen > now() - interval '5 seconds' end,
    'last', last, 'log', d.log, 'winner', win));
end $$;

-- kubok qulfi: ilovadan kelgan so'rovlar (liga_day_duel_me, liga_cup_list) qulf band bo'lsa kutmaydi — cron keyinroq tuzadi
create or replace function public.liga_cup_try_advance(p_group text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if pg_try_advisory_xact_lock(hashtext('liga_cup|' || p_group)) then
    perform public.liga_cup_advance(p_group);   -- xuddi shu qulf — shu tranzaksiyada qayta olinadi
  end if;
end $$;
revoke all on function public.liga_cup_try_advance(text) from public, anon, authenticated;

do $$
declare f text; fn text;
begin
  foreach fn in array array['public.liga_day_duel_me(uuid)', 'public.liga_cup_list(uuid)'] loop
    f := pg_get_functiondef(fn::regprocedure);
    if position('liga_cup_advance(' in f) > 0 then
      execute replace(f, 'public.liga_cup_advance(', 'public.liga_cup_try_advance(');
    end if;
  end loop;
end $$;
