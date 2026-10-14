-- 2026-10-14 · Guruhdagi duellar: 1) ilovadan guruhga tashlangan duel havolasini bot ham kuzatadi;
-- 2) duel tugashi bilan natija (ismlar bilan) va har bir savol bo'yicha kim to'g'ri / kim xato topgani chiqadi.

-- har savol yakunida kim xato javob bergani ham yoziladi (al/bl — a yoki b shu savolda xato qilgan)
create or replace function public.liga_live_next(p_code text, p_w text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.liga_live;
begin
  select * into d from public.liga_live where code = p_code;
  update public.liga_live set log = log || jsonb_build_object('k', d.cur, 'w', p_w, 'al', d.a_lock = d.cur, 'bl', d.b_lock = d.cur),
    cur = d.cur + 1, q_at = now() + interval '2500 milliseconds', a_lock = -1, b_lock = -1,
    status = case when d.cur + 1 >= array_length(d.qids, 1) then 'done' else 'play' end,
    finished_at = case when d.cur + 1 >= array_length(d.qids, 1) then now() end
  where code = p_code;
end $$;

-- bot: guruhga tashlangan duel havolasini ro'yxatga olish (faqat jonli, hali tugamagan duel)
create or replace function public.liga_group_track_sys(p_code text, p_chat bigint, p_msg bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.liga_live;
begin
  select * into l from public.liga_live where code = upper(trim(p_code));
  if l.code is null or l.kind = 'day' or l.status = 'done' then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from public.liga_group_posts g where g.code = l.code) then return jsonb_build_object('ok', false, 'dup', true); end if;
  insert into public.liga_group_posts(code, chat_id, msg_id) values (l.code, p_chat, p_msg);
  return jsonb_build_object('ok', true, 'a', public.liga_pname(l.a_id), 'b', public.liga_pname(l.b_id), 'status', l.status);
end $$;
revoke all on function public.liga_group_track_sys(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.liga_group_track_sys(text, bigint, bigint) to service_role;

-- bot: duel tafsiloti — har savol: savol, to'g'ri javob, kim birinchi topdi, kim xato qildi
create or replace function public.liga_live_detail_sys(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('a', public.liga_pname(l.a_id), 'b', public.liga_pname(l.b_id), 'a_pts', l.a_pts, 'b_pts', l.b_pts,
    'items', (select jsonb_agg(jsonb_build_object('k', i - 1,
                 'q', (case when l.lang = 'ru' then b.ru else b.uz end) ->> 'q', 't', b.t,
                 'o', case when b.t = 'mc' then (case when l.lang = 'ru' then b.ru else b.uz end) -> 'o' end,
                 'w', l.log -> (i - 1) ->> 'w', 'al', (l.log -> (i - 1) ->> 'al')::boolean, 'bl', (l.log -> (i - 1) ->> 'bl')::boolean)
               || public.liga_q_reveal(b, l.lang) - 'e' order by i)
              from generate_series(1, least(coalesce(jsonb_array_length(l.log), 0), coalesce(array_length(l.qids, 1), 0))) i
              join public.liga_bank b on b.id = l.qids[i]))
  from public.liga_live l where l.code = upper(trim(p_code))
$$;
revoke all on function public.liga_live_detail_sys(text) from public, anon, authenticated;
grant execute on function public.liga_live_detail_sys(text) to service_role;
