-- 2026-10-21d · Kubok duelida savollar ruscha chiqib qolardi: duel tili 1-o'yinchining (A) tilidan olinardi,
-- A ruschani tanlagan bo'lsa raqibiga ham ruscha ko'rinardi. Endi har bir ko'ruvchi savollarni O'Z tilida ko'radi
-- (ru — faqat o'zi ruschani tanlagan bo'lsa; uz/uzc — o'zbekcha, kirillga ilova o'giradi).
-- Javob tekshiruvi tilga bog'liq emas (dt/kt/a/variant tartibi bir xil), shuning uchun ballar o'zgarmaydi.
create or replace function public.liga_live_view(p_code text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.liga_live; side text; b public.liga_bank; pb public.liga_bank; last jsonb; an text; bn text; win text; L text;
begin
  select * into d from public.liga_live where code = p_code;
  if d.code is null then raise exception 'not_found'; end if;
  side := case when p_id = d.a_id then 'a' when p_id = d.b_id then 'b' end;
  select case when sp.lang = 'ru' then 'ru' else 'uz' end into L from public.safari_players sp where sp.id = p_id;
  L := coalesce(L, 'uz');
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into an from public.safari_players where id = d.a_id;
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || '.') into bn from public.safari_players where id = d.b_id;
  if d.status = 'play' and now() >= d.q_at then select * into b from public.liga_bank where id = d.qids[d.cur + 1]; end if;
  if d.cur > 0 then
    select * into pb from public.liga_bank where id = d.qids[d.cur];
    last := jsonb_build_object('k', d.cur - 1, 'w', d.log -> (d.cur - 1) -> 'w', 'q', (case when L = 'ru' then pb.ru else pb.uz end) ->> 'q',
      't', pb.t, 'o', case when pb.t = 'mc' then (case when L = 'ru' then pb.ru else pb.uz end) -> 'o' end) || public.liga_q_reveal(pb, L);
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
    'item', case when b.id is not null then public.liga_q_pub(b, L) || jsonb_build_object('k', d.cur) end,
    'locked', case side when 'a' then d.a_lock = d.cur when 'b' then d.b_lock = d.cur end,
    'opp_locked', case side when 'a' then d.b_lock = d.cur when 'b' then d.a_lock = d.cur end,
    'a_locked', case when d.status = 'play' then d.a_lock = d.cur end,
    'b_locked', case when d.status = 'play' then d.b_lock = d.cur end,
    'opp_here', case side when 'a' then d.b_seen > now() - interval '5 seconds' when 'b' then d.a_seen > now() - interval '5 seconds' end,
    'last', last, 'log', d.log, 'winner', win));
end $$;

-- yangi kubok duellari standart o'zbekcha (guruh xabarlari va h.k. uchun); ko'ruvchi baribir o'z tilida ko'radi
create or replace function public.liga_cup_new_duel(p_day date, p_group text, p_round integer, p_pos integer, p_a uuid, p_b uuid, p_slot time without time zone)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where liga_live.code = c); end loop;
  insert into public.liga_live(code, a_id, b_id, lang, qids, kind, win_from, win_to)
    values (c, p_a, p_b,
            (select case when count(*) filter (where sp.lang = 'ru') = 2 then 'ru' else 'uz' end from public.safari_players sp where sp.id in (p_a, p_b)),
            public.liga_draw_fresh(public.liga_all_pools(), 'day|' || c, 15, 0, 0, 0, array[p_a, p_b]), 'day',
            (p_day + p_slot) at time zone 'Asia/Tashkent', (p_day + p_slot + interval '30 minutes') at time zone 'Asia/Tashkent');
  insert into public.liga_day_duels(day, group_code, code, a_id, b_id, slot, round, pos, notified_pair)
    values (p_day, p_group, c, p_a, p_b, p_slot, p_round, p_pos, p_round = 1);
  return c;
end $$;

-- ochiq (hali tugamagan) aralash duellar o'zbekchaga
update public.liga_live l set lang = 'uz'
 where l.lang = 'ru' and l.status <> 'done'
   and exists (select 1 from public.safari_players p where p.id in (l.a_id, l.b_id) and coalesce(p.lang, 'uz') <> 'ru');
