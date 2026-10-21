-- 2026-10-21h: Sovrinli musobaqa — alohida to'lov (30 000 so'm, chek → administrator tasdiqlaydi),
-- o'yinda 20 ta savol, savollar o'yinchiga takrorlanmaydi (avval ko'rmaganlari, tugasa — eng eskisi),
-- qo'shilmaganlarga taklif (22.10 08:00 va 08:30).

insert into public.liga_bot_config(key, value) values
  ('px_q_n', '20'), ('px_secs', '800'), ('px_price', '30000'), ('px_invite_day', '2026-10-22')
on conflict (key) do update set value = excluded.value;

-- ---------- to'lovlar ----------
create table if not exists public.liga_px_pay (
  id bigserial primary key,
  player_id uuid not null references public.safari_players(id) on delete cascade,
  mon text not null,
  amount bigint not null,
  status text not null default 'check' check (status in ('check', 'paid', 'cancelled')),
  receipt text, img_hash text, tg_file_uid text, tg_file_id text, tg_chat_id bigint,
  created_at timestamptz not null default now(), decided_at timestamptz, decided_by bigint
);
create index if not exists liga_px_pay_player on public.liga_px_pay(player_id, mon);
alter table public.liga_px_pay enable row level security;

-- savollar tarixi (o'yinchiga takrorlanmasligi uchun)
create table if not exists public.liga_px_seen (
  player_id uuid not null references public.safari_players(id) on delete cascade,
  qid text not null,
  at timestamptz not null default now(),
  primary key (player_id, qid)
);
alter table public.liga_px_seen enable row level security;
-- mavjud sessiyalardagi savollarni tarixga yozamiz
insert into public.liga_px_seen(player_id, qid, at)
select x.player_id, q, max(x.started_at) from public.liga_px_sess x, unnest(x.seen) q group by x.player_id, q
on conflict (player_id, qid) do nothing;

create or replace function public.liga_px_paid(p_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.phone = any(string_to_array(coalesce((select value from public.liga_bot_config where key = 'free_phones'), ''), ','))
                   from public.safari_players s where s.id = p_id), false)
      or exists (select 1 from public.liga_px_pay p where p.player_id = p_id and p.mon = public.liga_px_mon() and p.status = 'paid')
$$;

create or replace function public.liga_px_pay_state(p_id uuid) returns text language sql stable security definer set search_path = public as $$
  select case when public.liga_px_paid(p_id) then 'paid'
              when exists (select 1 from public.liga_px_pay p where p.player_id = p_id and p.status = 'check') then 'check'
              when exists (select 1 from public.liga_px_pay p where p.player_id = p_id and p.mon = public.liga_px_mon() and p.status = 'cancelled') then 'cancelled'
              else 'none' end
$$;

create or replace function public.liga_px_fund(p_group text, p_mon text) returns bigint language sql stable security definer set search_path = public as $$
  select case when p_group <> 'ASOSIY' then 0 else
    public.liga_px_cfg('px_fund_base', '0')::bigint
    + public.liga_px_cfg('px_fund_per_pay', '0')::bigint * (select count(*) from public.liga_px_pay p where p.status = 'paid' and p.mon = p_mon) end
$$;

-- chek qabul qilish (ichki): takror, kutilayotgan, to'langan, bloklangan
create or replace function public.liga_px_receipt_add(p_player uuid, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare h text := case when p_image is null then null else md5(p_image) end; v bigint;
begin
  if public.liga_px_paid(p_player) then return jsonb_build_object('reason', 'paid'); end if;
  if exists (select 1 from public.liga_px_pay p where (h is not null and p.img_hash = h) or (p_uid is not null and p.tg_file_uid = p_uid))
     or exists (select 1 from public.liga_invoices i where (h is not null and i.img_hash = h) or (p_uid is not null and i.tg_file_uid = p_uid)) then
    return jsonb_build_object('reason', 'dup'); end if;
  if exists (select 1 from public.liga_px_pay p where p.player_id = p_player and p.status = 'check') then return jsonb_build_object('reason', 'pending'); end if;
  if (select count(*) from public.liga_px_pay p where p.player_id = p_player and p.status = 'cancelled' and p.created_at > now() - interval '7 days') >= 2 then
    return jsonb_build_object('reason', 'blocked'); end if;
  insert into public.liga_px_pay(player_id, mon, amount, receipt, img_hash, tg_file_uid, tg_file_id, tg_chat_id)
  values (p_player, public.liga_px_mon(), public.liga_px_cfg('px_price', '30000')::bigint, p_image, h, p_uid, p_file_id, p_chat)
  returning id into v;
  return jsonb_build_object('id', v);
end $$;

-- bot orqali (rasm Telegram'da)
create or replace function public.liga_px_receipt_sys(p_player uuid, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns jsonb language sql security definer set search_path = public as $$
  select public.liga_px_receipt_add(p_player, p_image, p_uid, p_file_id, p_chat)
$$;

-- ilova ichidan (rasm yuklanadi)
create or replace function public.liga_px_receipt_submit(p_id uuid, p_token text, p_image text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_image is null or p_image !~ '^data:image/(jpeg|png|webp);base64,' or length(p_image) > 1500000 then raise exception 'bad_image'; end if;
  r := public.liga_px_receipt_add(p_id, p_image, null, null, (select tg_user_id from public.safari_players where id = p_id));
  if r ? 'reason' then raise exception 'px_receipt_%', r->>'reason'; end if;
  begin perform public.liga_bot_call('pxreceipt:' || (r->>'id')); exception when others then null; end;
  return r;
end $$;
grant execute on function public.liga_px_receipt_submit(uuid, text, text) to anon, authenticated;

-- administrator ma'lumoti va qarori
create or replace function public.liga_px_pay_info_sys(p_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'player_id', p.player_id, 'amount', p.amount, 'mon', p.mon, 'status', p.status,
    'receipt', p.receipt, 'tg_file_id', p.tg_file_id,
    'name', trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')), 'phone', s.phone, 'region', s.region,
    'rejected', (select count(*) from public.liga_px_pay x where x.player_id = p.player_id and x.status = 'cancelled'),
    'admins', (select coalesce(jsonb_agg(a.chat_id), '[]') from public.liga_admin_chats a where a.group_code = 'ASOSIY'))
  from public.liga_px_pay p join public.safari_players s on s.id = p.player_id where p.id = p_id
$$;

create or replace function public.liga_px_decide_sys(p_id bigint, p_ok boolean, p_admin_chat bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not exists (select 1 from public.liga_admin_chats a where a.chat_id = p_admin_chat and a.group_code = 'ASOSIY') then
    return jsonb_build_object('done', false, 'reason', 'not_admin'); end if;
  update public.liga_px_pay set status = case when p_ok then 'paid' else 'cancelled' end, decided_at = now(), decided_by = p_admin_chat
   where id = p_id and status = 'check' returning * into p;
  if not found then
    return (select jsonb_build_object('done', false, 'reason', 'already', 'status', x.status) from public.liga_px_pay x where x.id = p_id); end if;
  return (select jsonb_build_object('done', true, 'status', p.status, 'player_chat', coalesce(p.tg_chat_id, s.tg_user_id), 'lang', s.lang,
                 'name', trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')))
            from public.safari_players s where s.id = p.player_id);
end $$;

-- qo'shilmaganlar ro'yxati (taklif uchun): Telegram'ga ulangan, shu oy to'lamagan va chek kutilmayotganlar
create or replace function public.liga_px_invite_list_sys(p_after bigint, p_limit int default 80)
returns table(tg_user_id bigint, first_name text, lang text)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, s.lang from public.safari_players s
   where s.tg_user_id is not null and s.tg_user_id > coalesce(p_after, 0)
     and public.liga_px_pay_state(s.id) in ('none', 'cancelled')
   order by s.tg_user_id limit p_limit
$$;
-- to'lov qilganlar (musobaqa boshlandi xabari uchun)
create or replace function public.liga_px_paid_list_sys(p_after bigint, p_limit int default 80)
returns table(tg_user_id bigint, first_name text, lang text)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, s.lang from public.safari_players s
   where s.tg_user_id is not null and s.tg_user_id > coalesce(p_after, 0) and public.liga_px_paid(s.id)
   order by s.tg_user_id limit p_limit
$$;
-- Telegram id bo'yicha o'yinchi (bot /start px)
create or replace function public.liga_px_by_tg_sys(p_tg bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'first_name', s.first_name, 'lang', s.lang, 'state', public.liga_px_pay_state(s.id))
    from public.safari_players s where s.tg_user_id = p_tg order by s.created_at desc limit 1
$$;

-- ---------- savollar: o'yinchi ko'rmaganlari birinchi, keyin eng eski ko'rganlari ----------
drop function if exists public.liga_px_q(text, text[]);
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
      select array_agg(code) into extra from (select code from public.liga_px_acc where code <> all(coalesce(opts, '{}')) order by random() limit 8 - coalesce(array_length(opts, 1), 0)) z;
      select array_agg(x order by random()) into opts from unnest(coalesce(opts, '{}') || coalesce(extra, '{}')) x;
      return jsonb_build_object('id', qid, 'lbid', lb.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', lb.dt, 'kt', lb.kt);
    end if;
    select * into b from public.liga_px_bank where id = coalesce(substr(qid, 2)::int, (select id from public.liga_px_bank order by random() limit 1));
    select array_agg(code) into extra from (select code from public.liga_px_acc where code <> all(b.o)
       order by (left(code, 1) in (left(b.dt, 1), left(b.kt, 1))) desc, random() limit 8 - coalesce(array_length(b.o, 1), 0)) z;
    select array_agg(x order by random()) into opts from unnest(b.o || coalesce(extra, '{}')) x;
    return jsonb_build_object('id', 'b' || b.id, 'bid', b.id, 't', 'pv', 'o', to_jsonb(opts), 'dt', b.dt, 'kt', b.kt);
  elsif p_kind = 'acc' then
    -- har schyot ikki xil so'raladi: raqam → nom (c2n) va nom → raqam (n2c)
    select z.code, z.m into v_code, m from (
      select a.code, mm.m, 'a' || a.code || mm.m id from public.liga_px_acc a, (values ('c2n'), ('n2c')) mm(m)) z
    left join public.liga_px_seen h on h.player_id = p_player and h.qid = z.id
    where z.id <> all(sn) and 'a' || z.code <> all(sn) order by h.at nulls first, random() limit 1;
    if v_code is null then select a.code into v_code from public.liga_px_acc a order by random() limit 1; m := 'c2n'; end if;
    select array_agg(code) into opts from (
      select code from public.liga_px_acc where code <> v_code
       order by (left(code,2) = left(v_code,2)) desc, (left(code,1) = left(v_code,1)) desc, random() limit 5) z;
    select array_agg(x order by random()) into opts from unnest(opts || v_code) x;
    return jsonb_build_object('id', 'a' || v_code || m, 't', 'acc', 'mode', m, 'code', v_code, 'o', to_jsonb(opts),
                              'a', array_position(opts, v_code) - 1);
  else
    select a.code, a.side into c from public.liga_px_acc a
      left join public.liga_px_seen h on h.player_id = p_player and h.qid = 's' || a.code
     where a.side <> 'n' and 's' || a.code <> all(sn) order by h.at nulls first, random() limit 1;
    if c.code is null then select a.code, a.side into c from public.liga_px_acc a where a.side <> 'n' order by random() limit 1; end if;
    return jsonb_build_object('id', 's' || c.code, 't', 'side', 'code', c.code, 'o', '["a","l","e","r","x"]'::jsonb,
                              'a', array_position(array['a','l','e','r','x'], c.side) - 1);
  end if;
end $$;

-- savol berilganda tarixga yoziladi
create or replace function public.liga_px_mark(p_player uuid, p_q jsonb) returns void language sql security definer set search_path = public as $$
  insert into public.liga_px_seen(player_id, qid, at) select p_player, p_q->>'id', now() where p_q is not null
  on conflict (player_id, qid) do update set at = now()
$$;

drop function if exists public.liga_px_start(uuid, text, text, text);
create or replace function public.liga_px_start(p_id uuid, p_token text, p_kind text, p_platform text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; secs int := public.liga_px_cfg('px_secs', '800')::int; g text; v_lang text; q jsonb;
        tn time := (now() at time zone 'Asia/Tashkent')::time;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_kind not in ('pv', 'acc', 'side') then raise exception 'bad_input'; end if;
  if public.liga_px_cfg('px_on', 'on') <> 'on' then raise exception 'px_off'; end if;
  if coalesce(p_platform, '') not in ('android', 'ios', 'android_app', 'mobile_web') then raise exception 'px_phone_only'; end if;
  if not public.liga_px_paid(p_id) then raise exception 'px_unpaid'; end if;
  if now() < public.liga_px_t0() then raise exception 'px_not_started'; end if;
  if tn < public.liga_px_cfg('px_open_from', '09:00')::time or tn >= public.liga_px_cfg('px_open_to', '18:00')::time then raise exception 'px_hours'; end if;
  if (select count(*) from public.liga_px_sess where player_id = p_id and started_at > now() - interval '1 minute') >= 6 then raise exception 'too_many'; end if;
  update public.liga_px_sess set finished = true where player_id = p_id and not finished;
  select coalesce(sp.group_code, 'ASOSIY'), coalesce(sp.lang, 'uz') into g, v_lang from public.safari_players sp where sp.id = p_id;
  q := public.liga_px_q(p_kind, '{}', p_id); perform public.liga_px_mark(p_id, q);
  -- 18:00 da hamma o'yinlar yopiladi
  insert into public.liga_px_sess(player_id, group_code, kind, ends_at, day, mon, cur, q_at, seen)
  values (p_id, g, p_kind, least(now() + make_interval(secs => secs),
            ((now() at time zone 'Asia/Tashkent')::date + public.liga_px_cfg('px_open_to', '18:00')::time) at time zone 'Asia/Tashkent'),
          public.liga_today(), public.liga_px_mon(), q, now(), array[q->>'id'])
  returning * into s;
  return jsonb_build_object('sid', s.id, 'kind', s.kind, 'secs', secs, 'left_ms', greatest(0, (extract(epoch from s.ends_at - now()) * 1000)::int),
                            'k', 0, 'score', 0, 'right_n', 0, 'done_n', 0, 'combo', 0,
                            'qs', public.liga_px_cfg('px_q_secs', '40')::int, 'qn', public.liga_px_cfg('px_q_n', '20')::int, 'q', public.liga_px_pub(q, v_lang));
end $$;
grant execute on function public.liga_px_start(uuid, text, text, text) to anon, authenticated;

create or replace function public.liga_px_answer(p_id uuid, p_token text, p_sid uuid, p_k integer, p_ans jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.liga_px_sess; ok boolean; fast boolean; slow boolean; pts int := 0; q jsonb; v_lang text; ans jsonb; e text; left_ms int;
        qs int := public.liga_px_cfg('px_q_secs', '40')::int; qn int := public.liga_px_cfg('px_q_n', '20')::int;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into s from public.liga_px_sess where id = p_sid and player_id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select coalesce(sp.lang, 'uz') into v_lang from public.safari_players sp where sp.id = p_id;
  left_ms := greatest(0, (extract(epoch from s.ends_at - now()) * 1000)::int);
  if s.finished or p_k <> s.done_n or s.cur is null or now() > s.ends_at + interval '2 seconds' then
    if not s.finished and now() > s.ends_at + interval '2 seconds' then update public.liga_px_sess set finished = true, cur = null where id = s.id; end if;
    return jsonb_build_object('stale', true, 'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo,
                              'left_ms', left_ms, 'over', s.finished or now() > s.ends_at, 'q', case when s.finished or now() > s.ends_at then null else public.liga_px_pub(s.cur, v_lang) end);
  end if;
  fast := now() - s.q_at < interval '350 milliseconds';
  slow := now() - s.q_at > make_interval(secs => qs + 3);
  if s.cur->>'t' = 'pv' then
    ok := coalesce(p_ans->>'dt', '') = s.cur->>'dt' and coalesce(p_ans->>'kt', '') = s.cur->>'kt';
    ans := jsonb_build_object('dt', s.cur->'dt', 'kt', s.cur->'kt');
    if s.cur ? 'lbid' then
      select case when v_lang = 'ru' and l.ru ? 'e' then l.ru->>'e' else l.uz->>'e' end into e from public.liga_bank l where l.id = s.cur->>'lbid';
    else
      select case when v_lang = 'ru' then e_ru else e_uz end into e from public.liga_px_bank where id = (s.cur->>'bid')::int;
    end if;
  else
    ok := (p_ans->>'pick') is not null and (p_ans->>'pick') ~ '^\d+$' and (p_ans->>'pick')::int = (s.cur->>'a')::int;
    ans := jsonb_build_object('a', s.cur->'a', 'code', s.cur->'code');
  end if;
  if fast or slow then ok := false; end if;
  if ok then s.combo := s.combo + 1; pts := public.liga_px_pts(s.combo); else s.combo := 0; end if;
  s.score := s.score + pts; s.right_n := s.right_n + ok::int; s.done_n := s.done_n + 1; s.best_combo := greatest(s.best_combo, s.combo);
  q := case when now() < s.ends_at and s.done_n < qn then public.liga_px_q(s.kind, s.seen, p_id) end;
  perform public.liga_px_mark(p_id, q);
  update public.liga_px_sess set score = s.score, right_n = s.right_n, done_n = s.done_n, combo = s.combo, best_combo = s.best_combo,
         cur = q, q_at = now(), seen = case when q is null then seen else seen || (q->>'id') end
   where id = s.id;
  return jsonb_build_object('ok', ok, 'why', case when fast then 'fast' when slow then 'slow' else '' end, 'ans', ans, 'e', coalesce(e, ''), 'got', pts,
                            'k', s.done_n, 'score', s.score, 'right_n', s.right_n, 'done_n', s.done_n, 'combo', s.combo,
                            'left_ms', left_ms, 'over', q is null, 'q', public.liga_px_pub(q, v_lang));
end $$;

-- liga_px_me: to'lov holati, narx, karta
create or replace function public.liga_px_me(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g text; v_mon text := public.liga_px_mon(); d date := public.liga_today(); tot record; mp bigint; rk int; n int; streak int := 0; dd date;
        fund bigint; v_sp int[]; t0 timestamptz := public.liga_px_t0();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select coalesce(sp.group_code, 'ASOSIY') into g from public.safari_players sp where sp.id = p_id;
  select count(*) filter (where public.liga_px_done(x)) games, coalesce(sum(right_n), 0) rights, coalesce(sum(done_n), 0) answers,
         coalesce(max(score) filter (where kind = 'pv'), 0) b_pv, coalesce(max(score) filter (where kind = 'acc'), 0) b_acc,
         coalesce(max(score) filter (where kind = 'side'), 0) b_side,
         count(*) filter (where public.liga_px_done(x) and day = d) today_games, coalesce(sum(score) filter (where day = d), 0) today_pts
    into tot from public.liga_px_sess x where x.player_id = p_id and x.started_at >= t0;
  select m.pts into mp from public.liga_px_month_pts(g, v_mon) m where m.player_id = p_id;
  select count(*) + 1 into rk from public.liga_px_month_pts(g, v_mon) m where m.pts > coalesce(mp, 0);
  select count(*) into n from public.liga_px_month_pts(g, v_mon);
  dd := case when exists (select 1 from public.liga_px_sess where player_id = p_id and day = d and done_n > 0 and started_at >= t0) then d else d - 1 end;
  while exists (select 1 from public.liga_px_sess where player_id = p_id and day = dd and done_n > 0 and started_at >= t0) and streak < 400 loop streak := streak + 1; dd := dd - 1; end loop;
  fund := public.liga_px_fund(g, v_mon); v_sp := public.liga_px_split();
  return jsonb_build_object('mon', v_mon, 'secs', public.liga_px_cfg('px_secs', '800')::int, 'qs', public.liga_px_cfg('px_q_secs', '40')::int,
    'qn', public.liga_px_cfg('px_q_n', '20')::int,
    'on', public.liga_px_cfg('px_on', 'on') = 'on',
    'start_at', case when t0 > '-infinity'::timestamptz then to_char(t0 at time zone 'Asia/Tashkent', 'YYYY-MM-DD"T"HH24:MI') end,
    'started', now() >= t0,
    'open_from', public.liga_px_cfg('px_open_from', '09:00'), 'open_to', public.liga_px_cfg('px_open_to', '18:00'),
    'end_day', to_char((date_trunc('month', d) + interval '1 month - 1 day')::date, 'YYYY-MM-DD'),
    'days_left', ((date_trunc('month', d) + interval '1 month - 1 day')::date - d) + 1,
    'today', jsonb_build_object('games', tot.today_games, 'pts', tot.today_pts),
    'month', jsonb_build_object('pts', coalesce(mp, 0), 'rank', case when coalesce(mp, 0) > 0 then rk end, 'n', n),
    'total', jsonb_build_object('games', tot.games, 'rights', tot.rights, 'answers', tot.answers, 'best', jsonb_build_object('pv', tot.b_pv, 'acc', tot.b_acc, 'side', tot.b_side)),
    'streak', streak, 'quests', '[]'::jsonb, 'ach', '[]'::jsonb,
    'fund', jsonb_build_object('amount', fund, 'split', to_jsonb(v_sp), 'prizes', (select coalesce(jsonb_agg(fund * u.x / 100 order by u.o), '[]') from unnest(v_sp) with ordinality u(x, o))),
    'eligible', public.liga_px_paid(p_id), 'pay', public.liga_px_pay_state(p_id),
    'price', public.liga_px_cfg('px_price', '30000')::int,
    'paid_n', (select count(*) from public.liga_px_pay p where p.mon = v_mon and p.status = 'paid'));
end $$;

-- takliflar: 22.10 08:00 va 08:30 (Toshkent) — har daqiqada 80 tadan
select cron.unschedule(jobid) from cron.job where jobname in ('liga-musobaqa-taklif-1', 'liga-musobaqa-taklif-2');
select cron.schedule('liga-musobaqa-taklif-1', '0-6 3 * * *', $c$select public.liga_bot_call('px_invite_a')$c$);
select cron.schedule('liga-musobaqa-taklif-2', '30-36 3 * * *', $c$select public.liga_bot_call('px_invite_b')$c$);
