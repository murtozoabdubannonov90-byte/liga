-- 2026-10-22b: Sovrinli musobaqa — kuniga 1 marta (20 ta aralash savol), chiqib ketsa davom ettiradi,
-- tugatgandan keyin ertagacha yopiq. Savollar qiyinroq (provodkada 10 variant) va bir hafta ichida takrorlanmaydi.

alter table public.liga_px_sess drop constraint if exists liga_px_sess_kind_check;
alter table public.liga_px_sess add constraint liga_px_sess_kind_check check (kind = any (array['pv', 'acc', 'side', 'mix']));

-- 20 ta savol tartibi: 12 provodka, 5 schyot, 3 balans bo'limi
create or replace function public.liga_px_mix_kind(p_k int) returns text language sql immutable as $$
  select (array['pv','acc','pv','side','pv','pv','acc','pv','pv','side','pv','acc','pv','pv','acc','pv','side','pv','acc','pv'])[(p_k % 20) + 1]
$$;

-- savol tanlash: o'yinchi 7 kun ichida ko'rgan savollar chiqmaydi; pool tugasa — eng eski ko'rilgani
create or replace function public.liga_px_q(p_kind text, p_seen text[], p_player uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare qid text; b record; c record; lb record; opts text[]; extra text[]; m text; v_code text; sn text[] := coalesce(p_seen, '{}');
begin
  if p_kind = 'pv' then
    select z.id into qid from (
      select 'b' || x.id id from public.liga_px_bank x
      union all
      select 'L' || l.id from public.liga_bank l
       where l.active and l.t = 'pv' and l.pool ~ '^d2026\d{4}$' and to_date(substr(l.pool, 2), 'YYYYMMDD') < public.liga_today()) z
    left join public.liga_px_seen h on h.player_id = p_player and h.qid = z.id
    where z.id <> all(sn) order by h.at nulls first, random() limit 1;
    if qid like 'L%' then
      select l.id, l.dt, l.kt, l.uz->'o' o into lb from public.liga_bank l where l.id = substr(qid, 2);
      select array_agg(x) into opts from jsonb_array_elements_text(lb.o) x;
      select array_agg(code) into extra from (select code from public.liga_px_acc where code <> all(coalesce(opts, '{}'))
         order by (left(code, 1) in (left(lb.dt, 1), left(lb.kt, 1))) desc, random() limit 10 - coalesce(array_length(opts, 1), 0)) z;
      select array_agg(x order by random()) into opts from unnest(coalesce(opts, '{}') || coalesce(extra, '{}')) x;
      return jsonb_build_object('id', qid, 'lbid', lb.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', lb.dt, 'kt', lb.kt);
    end if;
    select * into b from public.liga_px_bank where id = coalesce(substr(qid, 2)::int, (select id from public.liga_px_bank order by random() limit 1));
    -- chalg'ituvchilar: avval to'g'ri javob guruhidagi schyotlar (qiyinroq)
    select array_agg(code) into extra from (select code from public.liga_px_acc where code <> all(b.o)
       order by (left(code, 1) in (left(b.dt, 1), left(b.kt, 1))) desc, random() limit 10 - coalesce(array_length(b.o, 1), 0)) z;
    select array_agg(x order by random()) into opts from unnest(b.o || coalesce(extra, '{}')) x;
    return jsonb_build_object('id', 'b' || b.id, 'bid', b.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', b.dt, 'kt', b.kt);
  elsif p_kind = 'acc' then
    select z.code, z.m into v_code, m from (
      select a.code, mm.m, 'a' || a.code || mm.m id from public.liga_px_acc a, (values ('c2n'), ('n2c')) mm(m)) z
    left join public.liga_px_seen h on h.player_id = p_player and h.qid = z.id
    where z.id <> all(sn) and not exists (select 1 from unnest(sn) u where u like 'a' || z.code || '%') order by h.at nulls first, random() limit 1;
    if v_code is null then select a.code into v_code from public.liga_px_acc a order by random() limit 1; m := 'c2n'; end if;
    select array_agg(code) into opts from (
      select code from public.liga_px_acc where code <> v_code
       order by (left(code,2) = left(v_code,2)) desc, (left(code,1) = left(v_code,1)) desc, random() limit 5) z;
    select array_agg(x order by random()) into opts from unnest(opts || v_code) x;
    return jsonb_build_object('id', 'a' || v_code || m, 't', 'acc', 'mode', m, 'code', v_code, 'o', to_jsonb(opts),
                              'a', array_position(opts, v_code) - 1);
  elsif p_kind = 'side' then
    select a.code, a.side into c from public.liga_px_acc a
      left join public.liga_px_seen h on h.player_id = p_player and h.qid = 's' || a.code
     where a.side <> 'n' and 's' || a.code <> all(sn) order by h.at nulls first, random() limit 1;
    if c.code is null then select a.code, a.side into c from public.liga_px_acc a where a.side <> 'n' order by random() limit 1; end if;
    return jsonb_build_object('id', 's' || c.code, 't', 'side', 'code', c.code, 'o', '["a","l","e","r","x"]'::jsonb,
                              'a', array_position(array['a','l','e','r','x'], c.side) - 1);
  else
    return public.liga_px_q(public.liga_px_mix_kind(coalesce(array_length(sn, 1), 0)), sn, p_player);
  end if;
end $$;

-- bugungi sessiya
create or replace function public.liga_px_today(p_id uuid) returns public.liga_px_sess language sql stable security definer set search_path = public as $$
  select * from public.liga_px_sess x where x.player_id = p_id and x.day = public.liga_today() and x.started_at >= public.liga_px_t0()
   order by x.started_at desc limit 1
$$;
create or replace function public.liga_px_complete(s public.liga_px_sess) returns boolean language sql stable as $$
  select s.id is not null and (s.finished or s.done_n >= public.liga_px_cfg('px_q_n', '20')::int or now() > s.ends_at)
$$;

-- joriy savolni xato deb hisoblab keyingisiga o'tish (qayta kirilganda yoki ilovadan chiqilganda)
create or replace function public.liga_px_skip(p_sid uuid) returns public.liga_px_sess language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; q jsonb; qn int := public.liga_px_cfg('px_q_n', '20')::int;
begin
  select * into s from public.liga_px_sess where id = p_sid for update;
  if s.cur is null or s.finished then return s; end if;
  s.done_n := s.done_n + 1; s.combo := 0;
  q := case when now() < s.ends_at and s.done_n < qn then public.liga_px_q(s.kind, s.seen, s.player_id) end;
  perform public.liga_px_mark(s.player_id, q);
  update public.liga_px_sess set done_n = s.done_n, combo = 0, cur = q, q_at = now(),
         seen = case when q is null then seen else seen || (q->>'id') end, finished = (q is null)
   where id = s.id returning * into s;
  return s;
end $$;

drop function if exists public.liga_px_start(uuid, text, text, text);
create or replace function public.liga_px_start(p_id uuid, p_token text, p_kind text, p_platform text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; g text; v_lang text; q jsonb; resumed boolean := false;
        tn time := (now() at time zone 'Asia/Tashkent')::time; qs int := public.liga_px_cfg('px_q_secs', '40')::int; qn int := public.liga_px_cfg('px_q_n', '20')::int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if public.liga_px_cfg('px_on', 'on') <> 'on' then raise exception 'px_off'; end if;
  if coalesce(p_platform, '') not in ('android', 'ios', 'android_app', 'mobile_web') then raise exception 'px_phone_only'; end if;
  if not public.liga_px_paid(p_id) then raise exception 'px_unpaid'; end if;
  if now() < public.liga_px_t0() then raise exception 'px_not_started'; end if;
  if tn < public.liga_px_cfg('px_open_from', '09:00')::time or tn >= public.liga_px_cfg('px_open_to', '18:00')::time then raise exception 'px_hours'; end if;
  select coalesce(sp.group_code, 'ASOSIY'), coalesce(sp.lang, 'uz') into g, v_lang from public.safari_players sp where sp.id = p_id;
  s := public.liga_px_today(p_id);
  if s.id is not null then
    -- kuniga bir marta: tugatgan bo'lsa — ertagacha yopiq
    if public.liga_px_complete(s) then
      if not s.finished then update public.liga_px_sess set finished = true, cur = null where id = s.id; end if;
      raise exception 'px_done_today';
    end if;
    -- qayta kirish: ko'rilgan savol xato hisoblanadi (boshqa joyda javob qidirib qaytishning oldini olish)
    if now() - s.q_at > interval '3 seconds' then s := public.liga_px_skip(s.id); end if;
    if s.cur is null then raise exception 'px_done_today'; end if;
    resumed := true;
  else
    update public.liga_px_sess set finished = true where player_id = p_id and not finished;
    q := public.liga_px_q('mix', '{}', p_id); perform public.liga_px_mark(p_id, q);
    insert into public.liga_px_sess(player_id, group_code, kind, ends_at, day, mon, cur, q_at, seen)
    values (p_id, g, 'mix', ((now() at time zone 'Asia/Tashkent')::date + public.liga_px_cfg('px_open_to', '18:00')::time) at time zone 'Asia/Tashkent',
            public.liga_today(), public.liga_px_mon(), q, now(), array[q->>'id'])
    returning * into s;
  end if;
  return jsonb_build_object('sid', s.id, 'kind', s.kind, 'secs', qn * qs, 'left_ms', greatest(0, (extract(epoch from s.ends_at - now()) * 1000)::int),
                            'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo, 'resumed', resumed,
                            'qs', qs, 'qn', qn, 'q', public.liga_px_pub(s.cur, v_lang));
end $$;
grant execute on function public.liga_px_start(uuid, text, text, text) to anon, authenticated;

-- javob: {"away":true} yoki {"timeout":true} — xato; kind 'mix' da savol turi cur->>'t' dan
-- (liga_px_answer o'zgarmaydi: u s.kind ni liga_px_q ga beradi, 'mix' esa navbatdagi turini o'zi tanlaydi)

-- yakunlash: faqat hamma savol tugaganda (yoki 18:00) yopiladi; oraliqda chiqib ketsa — keyin davom etadi
create or replace function public.liga_px_finish(p_id uuid, p_token text, p_sid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; best int; mp bigint; rk int; g text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into s from public.liga_px_sess where id = p_sid and player_id = p_id;
  if not found then raise exception 'not_found'; end if;
  if public.liga_px_complete(s) then
    update public.liga_px_sess set finished = true, cur = null where id = s.id returning * into s;
  end if;
  select max(score) into best from public.liga_px_sess where player_id = p_id and id <> s.id and started_at >= public.liga_px_t0();
  g := s.group_code;
  select m.pts into mp from public.liga_px_month_pts(g, s.mon) m where m.player_id = p_id;
  select count(*) + 1 into rk from public.liga_px_month_pts(g, s.mon) m where m.pts > coalesce(mp, 0);
  return jsonb_build_object('kind', s.kind, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'best_combo', s.best_combo,
                            'record', s.score > coalesce(best, 0) and s.score > 0, 'prev_best', coalesce(best, 0), 'done', s.finished,
                            'quests_new', '[]'::jsonb, 'month_pts', coalesce(mp, 0), 'month_rank', rk);
end $$;

-- liga_px_me ga bugungi holat: none | active | done
create or replace function public.liga_px_day_state(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.liga_px_sess := public.liga_px_today(p_id);
begin
  if s.id is null then return jsonb_build_object('state', 'none'); end if;
  return jsonb_build_object('state', case when public.liga_px_complete(s) then 'done' else 'active' end,
                            'k', s.done_n, 'score', s.score, 'right_n', s.right_n);
end $$;

do $d$
declare src text;
begin
  select pg_get_functiondef('public.liga_px_me(uuid, text)'::regprocedure) into src;
  if position('''day'', public.liga_px_day_state(p_id)' in src) = 0 then
    src := replace(src, '''eligible'', public.liga_px_paid(p_id),', '''eligible'', public.liga_px_paid(p_id), ''day'', public.liga_px_day_state(p_id),');
    execute src;
  end if;
end $d$;
