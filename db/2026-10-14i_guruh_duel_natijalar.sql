-- 2026-10-14 · Muhokama guruhi: duelga chaqiruv (birinchi qabul qilgan o'ynaydi) va natijalar guruhga.
--  • /duel — guruhda jonli duelga chaqiruv; «Qabul qilish» tugmasini birinchi bosgan raqib bo'ladi, boshqalarniki qabul qilinmaydi.
--  • chaqiruv 30 daqiqada qabul qilinmasa — bekor bo'ladi; duel tugagach natija o'sha xabarga yoziladi.
--  • kunlik kubok: har raund tugagach natijalari guruhga chiqadi (bosqich yakuni va kuchli uchlik — avvaldan day_end da chiqadi).

create table if not exists public.liga_group_posts(
  code text primary key,
  chat_id bigint not null,
  msg_id bigint not null,
  posted boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.liga_group_posts enable row level security;

create table if not exists public.liga_cup_round_posts(
  day date not null, group_code text not null, round int not null, posted_at timestamptz not null default now(),
  primary key (day, group_code, round)
);
alter table public.liga_cup_round_posts enable row level security;
-- o'tgan kunlarning raundlari e'lon qilingan deb belgilanadi (eski natijalar to'kilib ketmasin)
insert into public.liga_cup_round_posts(day, group_code, round)
  select distinct day, group_code, round from public.liga_day_duels where day < public.liga_today()
  on conflict do nothing;

create or replace function public.liga_pname(p uuid) returns text language sql stable security definer set search_path = public as $$
  select trim(coalesce(first_name,'') || ' ' || left(coalesce(last_name,''),1) || case when coalesce(last_name,'') <> '' then '.' else '' end)
  from public.safari_players where id = p
$$;

-- bot: Telegram foydalanuvchisidan duel yaratish (ilovadagi liga_live_create bilan bir xil cheklovlar)
create or replace function public.liga_live_create_sys(p_tg bigint, p_lang text default 'uz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid; c text;
begin
  select id into pid from public.safari_players where tg_user_id = p_tg order by last_active desc nulls last limit 1;
  if pid is null then return jsonb_build_object('err', 'no_player'); end if;
  if not public.liga_player_ok(pid) then return jsonb_build_object('err', 'unpaid'); end if;
  if exists (select 1 from public.liga_live l join public.liga_group_posts g on g.code = l.code
              where l.a_id = pid and l.status = 'wait' and l.b_id is null and l.created_at > now() - interval '30 minutes') then
    return jsonb_build_object('err', 'open_exists');
  end if;
  if (select count(*) from public.liga_live where a_id = pid and created_at > now() - interval '1 day') >= 30 then return jsonb_build_object('err', 'too_many'); end if;
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where code = c); end loop;
  insert into public.liga_live(code, a_id, lang, qids, a_seen)
    values (c, pid, case when p_lang = 'ru' then 'ru' else 'uz' end, public.liga_draw_fresh(public.liga_all_pools(), 'live|' || c, 4, 3, 3, 0, array[pid]), now());
  return jsonb_build_object('code', c, 'name', public.liga_pname(pid));
end $$;

create or replace function public.liga_group_post_add_sys(p_code text, p_chat bigint, p_msg bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.liga_group_posts(code, chat_id, msg_id) values (p_code, p_chat, p_msg)
  on conflict (code) do update set chat_id = excluded.chat_id, msg_id = excluded.msg_id;
$$;

-- bot: «Qabul qilish» — atomar: faqat birinchi bosgan raqib bo'ladi
create or replace function public.liga_live_take_sys(p_code text, p_tg bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.liga_live; pid uuid;
begin
  select id into pid from public.safari_players where tg_user_id = p_tg order by last_active desc nulls last limit 1;
  if pid is null then return jsonb_build_object('r', 'no_player'); end if;
  select * into l from public.liga_live where code = upper(trim(p_code)) for update;
  if l.code is null then return jsonb_build_object('r', 'not_found'); end if;
  if l.a_id = pid then return jsonb_build_object('r', 'self'); end if;
  if l.b_id = pid then return jsonb_build_object('r', 'ok', 'a', public.liga_pname(l.a_id), 'b', public.liga_pname(pid), 'again', true); end if;
  if l.b_id is not null then return jsonb_build_object('r', 'taken', 'b', public.liga_pname(l.b_id)); end if;
  if l.status <> 'wait' or l.created_at < now() - interval '30 minutes' then return jsonb_build_object('r', 'expired'); end if;
  if not public.liga_player_ok(pid) then return jsonb_build_object('r', 'unpaid'); end if;
  update public.liga_live set b_id = pid where code = l.code;
  return jsonb_build_object('r', 'ok', 'a', public.liga_pname(l.a_id), 'b', public.liga_pname(pid),
    'a_tg', (select tg_user_id from public.safari_players where id = l.a_id));
end $$;

-- bot: guruh chaqiruvlari bo'yicha bajariladigan ishlar (bir martalik — posted belgilanadi)
create or replace function public.liga_group_due_sys()
returns table(kind text, code text, chat_id bigint, msg_id bigint, a_name text, b_name text, a_pts int, b_pts int, winner text, note text)
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select g.code from public.liga_group_posts g where not g.posted loop
    perform public.liga_live_tick(r.code);
  end loop;
  -- 30 daqiqada hech kim qabul qilmadi — bekor
  update public.liga_live l set status = 'done', note = 'cancel', finished_at = now()
   from public.liga_group_posts g
   where g.code = l.code and not g.posted and l.b_id is null and l.status = 'wait' and l.created_at < now() - interval '30 minutes';
  -- qabul qilindi, lekin 2 soatda boshlanmadi — bekor
  update public.liga_live l set status = 'done', note = 'cancel', finished_at = now()
   from public.liga_group_posts g
   where g.code = l.code and not g.posted and l.status = 'wait' and l.created_at < now() - interval '2 hours';
  return query
  with d as (
    update public.liga_group_posts g set posted = true
      from public.liga_live l
     where l.code = g.code and not g.posted and l.status = 'done'
    returning g.code, g.chat_id, g.msg_id, l.a_id, l.b_id, l.a_pts, l.b_pts, l.a_ms, l.b_ms, l.note)
  select case when d.b_id is null then 'expired' else 'done' end, d.code, d.chat_id, d.msg_id,
    public.liga_pname(d.a_id), public.liga_pname(d.b_id), d.a_pts, d.b_pts,
    case when d.note = 'cancel' then null
         when d.a_pts > d.b_pts then 'a' when d.b_pts > d.a_pts then 'b'
         when d.a_pts > 0 and d.a_ms < d.b_ms then 'a' when d.b_pts > 0 and d.b_ms < d.a_ms then 'b' else 'tie' end,
    d.note
  from d;
end $$;

-- bot: kubokning tugagan raundlari (har biri bir marta)
create or replace function public.liga_cup_rounds_due_sys()
returns table(group_code text, round int, stage text, lines jsonb)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today();
begin
  return query
  with fin as (
    select x.group_code gc, x.round rn from public.liga_day_duels x
     where x.day = td
     group by x.group_code, x.round
    having bool_and(x.winner is not null)
       and not exists (select 1 from public.liga_cup_round_posts p where p.day = td and p.group_code = x.group_code and p.round = x.round)),
  ins as (
    insert into public.liga_cup_round_posts(day, group_code, round) select td, fin.gc, fin.rn from fin
    on conflict do nothing returning liga_cup_round_posts.group_code gc, liga_cup_round_posts.round rn)
  select ins.gc, ins.rn, public.liga_cup_rstage(td, ins.gc, ins.rn),
    (select jsonb_agg(jsonb_build_object('a', public.liga_pname(x.a_id), 'b', public.liga_pname(x.b_id),
        'ap', l.a_pts, 'bp', l.b_pts, 'w', case when x.winner = x.a_id then 'a' else 'b' end, 'note', l.note) order by x.pos)
       from public.liga_day_duels x join public.liga_live l on l.code = x.code
      where x.day = td and x.group_code = ins.gc and x.round = ins.rn)
  from ins;
end $$;

-- cron (har 2 daqiqada): ish bo'lsa botni chaqiradi
create or replace function public.liga_group_tick()
returns void language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); r record;
begin
  for r in select distinct x.group_code gc from public.liga_day_duels x where x.day = td loop
    perform public.liga_cup_advance(r.gc);
  end loop;
  for r in select g.code from public.liga_group_posts g where not g.posted loop
    perform public.liga_live_tick(r.code);
  end loop;
  if exists (select 1 from public.liga_group_posts g join public.liga_live l on l.code = g.code
              where not g.posted and (l.status = 'done' or (l.status = 'wait' and l.created_at < now() - interval '30 minutes' and l.b_id is null)
                                      or (l.status = 'wait' and l.created_at < now() - interval '2 hours')))
     or exists (select 1 from public.liga_day_duels x where x.day = td
                 group by x.group_code, x.round having bool_and(x.winner is not null)
                   and not exists (select 1 from public.liga_cup_round_posts p where p.day = td and p.group_code = x.group_code and p.round = x.round)) then
    perform public.liga_bot_call('group_due');
  end if;
end $$;

revoke all on function public.liga_live_create_sys(bigint, text) from public, anon, authenticated;
revoke all on function public.liga_group_post_add_sys(text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.liga_live_take_sys(text, bigint) from public, anon, authenticated;
revoke all on function public.liga_group_due_sys() from public, anon, authenticated;
revoke all on function public.liga_cup_rounds_due_sys() from public, anon, authenticated;
revoke all on function public.liga_group_tick() from public, anon, authenticated;
revoke all on function public.liga_pname(uuid) from public, anon, authenticated;
grant execute on function public.liga_live_create_sys(bigint, text) to service_role;
grant execute on function public.liga_group_post_add_sys(text, bigint, bigint) to service_role;
grant execute on function public.liga_live_take_sys(text, bigint) to service_role;
grant execute on function public.liga_group_due_sys() to service_role;
grant execute on function public.liga_cup_rounds_due_sys() to service_role;
grant execute on function public.liga_pname(uuid) to service_role;

-- oddiy guruh superguruhga aylanganda: yangi id va havola (takliflar qayta yuborilmaydi)
create or replace function public.liga_discuss_move_sys(p_chat bigint, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.liga_bot_config set value = p_chat::text where key = 'discuss_chat';
  update public.liga_bot_config set value = p_link where key = 'discuss_link';
end $$;
revoke all on function public.liga_discuss_move_sys(bigint, text) from public, anon, authenticated;
grant execute on function public.liga_discuss_move_sys(bigint, text) to service_role;

-- bugun allaqachon tugagan raundlar qayta to'kilmasin (faqat bundan keyingilari chiqadi)
insert into public.liga_cup_round_posts(day, group_code, round)
  select x.day, x.group_code, x.round from public.liga_day_duels x where x.day = public.liga_today()
  group by x.day, x.group_code, x.round having bool_and(x.winner is not null)
  on conflict do nothing;

select cron.schedule('liga-guruh-natija', '*/2 * * * *', 'select public.liga_group_tick()');
