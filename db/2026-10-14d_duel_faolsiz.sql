-- 2026-10-14 · Kubok dueli o'ynalmay "osilib" qolmasin.
-- Muammo: ikkala o'yinchi duelga kirgan, lekin javob bermayapti — har savol 1,5 daqiqada o'z-o'zidan o'tadi,
-- 15 savol ~23 daqiqa davom etadi va keyingi raund kechikadi.
-- Yechim (faqat kunlik kubok duellari, kind = 'day'):
--   • har bir javob urinishi (to'g'ri yoki xato) vaqti saqlanadi: a_act / b_act;
--   • o'yinchi 3 daqiqa (2 savol) davomida birorta ham javob bermasa — «faolsiz» hisoblanadi;
--   • ikkalasi ham faolsiz → duel shu zahoti yakunlanadi (note = 'idle2'): ochko/vaqt bo'yicha, teng bo'lsa — kubok qoidasi (tasodifiy);
--   • biri faolsiz, ikkinchisi o'ynayapti → duel yakunlanadi, o'ynayotgan yutadi (note = 'idle'):
--     agar u oldinda bo'lmasa, ochkosi raqibnikidan 1 ta ko'p qilib qo'yiladi (kelmaganlikdagi 1:0 kabi).

alter table public.liga_live add column if not exists a_act timestamptz;
alter table public.liga_live add column if not exists b_act timestamptz;

create or replace function public.liga_live_idle_sec() returns int language sql immutable as $$ select 180 $$;

create or replace function public.liga_live_tick(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.liga_live; i int := 0; base timestamptz; a_idle boolean; b_idle boolean;
begin
  select * into d from public.liga_live where code = p_code for update;
  if d.code is null then return; end if;
  if d.status = 'wait' and d.win_to is not null and now() > d.win_to then
    update public.liga_live set status = 'done', finished_at = now(),
      a_pts = case when d.a_seen >= d.win_from then 1 else 0 end, b_pts = case when d.b_seen >= d.win_from then 1 else 0 end,
      note = case when d.a_seen >= d.win_from and d.b_seen >= d.win_from then 'cancel'
                  when d.a_seen >= d.win_from or d.b_seen >= d.win_from then 'forfeit' else 'cancel' end
    where code = p_code;
    return;
  end if;
  if d.status = 'wait' and d.b_id is not null and (d.win_from is null or now() >= d.win_from)
     and d.a_seen > now() - interval '5 seconds' and d.b_seen > now() - interval '5 seconds' then
    update public.liga_live set status = 'play', started_at = now(), cur = 0, q_at = now() + interval '4 seconds' where code = p_code;
    return;
  end if;
  -- kubok: faolsiz o'yinchi(lar) — duelni yakunlash
  if d.status = 'play' and d.kind = 'day' and d.started_at is not null then
    base := d.started_at + interval '4 seconds';
    a_idle := now() - greatest(base, coalesce(d.a_act, base)) > make_interval(secs => public.liga_live_idle_sec());
    b_idle := now() - greatest(base, coalesce(d.b_act, base)) > make_interval(secs => public.liga_live_idle_sec());
    if a_idle and b_idle then
      update public.liga_live set status = 'done', finished_at = now(), note = 'idle2' where code = p_code;
      return;
    elsif a_idle then
      update public.liga_live set status = 'done', finished_at = now(), note = 'idle',
        b_pts = greatest(d.b_pts, d.a_pts + 1) where code = p_code;
      return;
    elsif b_idle then
      update public.liga_live set status = 'done', finished_at = now(), note = 'idle',
        a_pts = greatest(d.a_pts, d.b_pts + 1) where code = p_code;
      return;
    end if;
  end if;
  while d.status = 'play' and now() > d.q_at + make_interval(secs => public.liga_live_qsec()) and i < 12 loop
    perform public.liga_live_next(p_code, null);
    select * into d from public.liga_live where code = p_code; i := i + 1;
  end loop;
end $$;

create or replace function public.liga_live_answer(p_id uuid, p_token text, p_code text, p_k integer, p_ans jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_live; c text := upper(trim(p_code)); side text; b public.liga_bank; ok boolean; why text := ''; ms int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  perform public.liga_live_tick(c);
  select * into d from public.liga_live where code = c for update;
  if d.code is null then raise exception 'not_found'; end if;
  side := case when p_id = d.a_id then 'a' when p_id = d.b_id then 'b' end;
  if side is null then raise exception 'duel_taken'; end if;
  -- har qanday javob urinishi — o'yinchi faol
  if d.status = 'play' then
    if side = 'a' then update public.liga_live set a_act = now() where code = c; else update public.liga_live set b_act = now() where code = c; end if;
  end if;
  if d.status <> 'play' or p_k is distinct from d.cur or now() < d.q_at then
    why := 'late';
  elsif (side = 'a' and d.a_lock = d.cur) or (side = 'b' and d.b_lock = d.cur) then
    why := 'locked';
  else
    select * into b from public.liga_bank where id = d.qids[d.cur + 1];
    ok := public.liga_q_ok(b, coalesce(p_ans, '{}'::jsonb));
    if ok then
      ms := (extract(epoch from (now() - d.q_at)) * 1000)::int;
      if side = 'a' then update public.liga_live set a_pts = a_pts + 1, a_ms = a_ms + ms where code = c;
      else update public.liga_live set b_pts = b_pts + 1, b_ms = b_ms + ms where code = c; end if;
      perform public.liga_live_next(c, side);
    else
      why := 'wrong';
      if side = 'a' then update public.liga_live set a_lock = d.cur where code = c; else update public.liga_live set b_lock = d.cur where code = c; end if;
      if (side = 'a' and d.b_lock = d.cur) or (side = 'b' and d.a_lock = d.cur) then perform public.liga_live_next(c, null); end if;
    end if;
  end if;
  return public.liga_live_view2(c, p_id) || jsonb_build_object('ok', coalesce(ok, false), 'why', why);
end $$;
