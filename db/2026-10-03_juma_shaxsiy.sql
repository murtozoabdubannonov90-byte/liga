-- Hisobchi Liga — 2026-10-03
-- 1) Juma: bosqich 12:00 gacha; yangi hafta faqat shanbadan boshlab bosqichlarni qabul qiladi (fri-6)
-- 2) Ochkolar o'chib ketmasin: liga_save shu hafta bosqich ballarini va jami XP ni kamaytirmaydi
-- 3) Chek: ko'pi bilan 6 oy, bot orqali ham kuniga 5 tadan ko'p emas
-- 4) Telegram ulash: ilovadagi havola kodi, to'lov/kontakt orqali avtomatik
-- 5) Bot uchun ro'yxatlar: ertalabki shaxsiy xabar, juma natijasi, bugun o'ynaganlar soni
-- Hammasi "create or replace" / yangi funksiya — hech narsa o'chirilmaydi.

create or replace function public.liga_allowed_stages(p_group text)
returns integer[] language sql stable security definer set search_path = public as $$
  with g as (select start_date from public.liga_groups where code = p_group),
  w as (select (substr(public.liga_cur_week_id(),1,10))::date as fri)
  select coalesce(array_agg(distinct public.liga_stage_index(g.start_date, d::date)) filter (where public.liga_stage_index(g.start_date, d::date) is not null), '{}')
  from g, w, generate_series(w.fri - 6, least(w.fri, public.liga_today()), interval '1 day') d
$$;

create or replace function public.liga_save(p_id uuid, p_token text, p_xp integer, p_stages integer, p_streak integer, p_first text, p_last text,
  p_week_daily integer, p_week_blitz integer, p_week_bonus integer, p_week_stages jsonb, p_region text default null, p_acc_ok integer default 0, p_acc_total integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare g text; allowed int[]; k text; v int; st jsonb := '{}'::jsonb; old jsonb; wid text := public.liga_cur_week_id();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select group_code, case when week_id = wid then coalesce(week_stages, '{}'::jsonb) else '{}'::jsonb end into g, old
    from public.safari_players where id = p_id;
  if public.liga_player_ok(p_id) then
    allowed := public.liga_allowed_stages(g);
    for k, v in select key, coalesce((value)::text::int, 0) from jsonb_each(coalesce(p_week_stages, '{}'::jsonb)) loop
      if k ~ '^\d+$' and k::int = any(allowed) then st := st || jsonb_build_object(k, greatest(0, least(v, 450))); end if;
    end loop;
    -- serverdagi ball yo'qolmaydi (telefon almashsa, xotira tozalansa)
    for k, v in select key, coalesce((value)::text::int, 0) from jsonb_each(old) loop
      if coalesce((st->>k)::int, -1) < v then st := st || jsonb_build_object(k, v); end if;
    end loop;
  else
    st := old;
  end if;
  update public.safari_players set xp = greatest(xp, p_xp, 0), week_id = wid, week_stages = st,
    week_daily = greatest(0, coalesce(p_week_daily,0)), week_blitz = greatest(0, coalesce(p_week_blitz,0)), week_bonus = greatest(0, coalesce(p_week_bonus,0)),
    stages = greatest(stages, p_stages, 0), streak = greatest(0, p_streak), last_active = now(),
    first_name = coalesce(nullif(trim(p_first),''), first_name), last_name = coalesce(p_last, last_name),
    region = coalesce(public.liga_region_ok(p_region), region),
    acc_ok = greatest(0, coalesce(p_acc_ok,0)), acc_total = greatest(0, coalesce(p_acc_total,0))
  where id = p_id;
end $$;

-- o'z ma'lumotlari (ilova serverdagisi bilan birlashtiradi)
create or replace function public.liga_me(p_id uuid, p_token text)
returns table(xp int, stages int, week_id text, week_stages jsonb, cur_week text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return query select s.xp, s.stages, s.week_id, coalesce(s.week_stages, '{}'::jsonb), public.liga_cur_week_id() from public.safari_players s where s.id = p_id;
end $$;

-- cheklar: 1–6 oy; bot yo'li ham kuniga 5 ta
create or replace function public.liga_receipt_sys(p_player uuid, p_months integer, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns table(id bigint, paid_until date, dup boolean) language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 6)); pr int; g text; prev date; nu date; inv bigint;
begin
  if exists (select 1 from public.liga_invoices i where i.tg_file_uid = p_uid) then
    return query select null::bigint, null::date, true; return;
  end if;
  if (select count(*) from public.liga_invoices i where i.player_id = p_player and i.created_at > now() - interval '1 day') >= 5 then raise exception 'too_many'; end if;
  select s.group_code, s.paid_until into g, prev from public.safari_players s where s.id = p_player;
  if g is null then raise exception 'not_found'; end if;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_player, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, paid_at, tg_file_uid, tg_file_id, tg_chat_id)
    values (g, 1, m, pr::bigint * m, 'check', 'karta (bot)', p_player, p_image, prev, now(), p_uid, p_file_id, p_chat) returning liga_invoices.id into inv;
  return query select inv, nu, false;
end $$;

create or replace function public.liga_receipt_submit(p_id uuid, p_token text, p_months integer, p_image text)
returns table(id bigint, paid_until date) language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 6)); pr int; g text; prev date; nu date; inv bigint;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_image is null or p_image !~ '^data:image/(jpeg|png|webp);base64,' or length(p_image) > 1500000 then raise exception 'bad_image'; end if;
  if (select count(*) from public.liga_invoices i where i.player_id = p_id and i.created_at > now() - interval '1 day') >= 5 then raise exception 'too_many'; end if;
  select s.group_code, s.paid_until into g, prev from public.safari_players s where s.id = p_id;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_id, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, paid_at)
    values (g, 1, m, pr::bigint * m, 'check', 'karta', p_id, p_image, prev, now()) returning liga_invoices.id into inv;
  begin perform public.liga_bot_call('receipt:' || inv); exception when others then null; end;
  return query select inv, nu;
end $$;

-- Telegram ulash: ilova kod oladi → bot /start link_KOD
create or replace function public.liga_tg_link_code(p_id uuid, p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare c text := encode(extensions.gen_random_bytes(9), 'hex');
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  insert into public.liga_tg_links(code, kind, player_id) values (c, 'link', p_id);
  return 'link_' || c;
end $$;

-- bot: o'yinchini Telegram hisobiga bog'lash (kod, to'lov havolasi yoki tasdiqlangan kontakt orqali)
create or replace function public.liga_tg_bind_sys(p_player uuid, p_tg bigint)
returns table(first_name text, lang text) language plpgsql security definer set search_path = public as $$
begin
  update public.safari_players set tg_user_id = null where tg_user_id = p_tg and id <> p_player;
  update public.safari_players set tg_user_id = p_tg where id = p_player;
  return query select s.first_name, coalesce(s.lang, 'uz') from public.safari_players s where s.id = p_player;
end $$;

create or replace function public.liga_tg_link_use_sys(p_code text, p_tg bigint)
returns table(first_name text, lang text) language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select l.player_id into pid from public.liga_tg_links l
    where l.code = p_code and l.kind = 'link' and l.used_at is null and l.created_at > now() - interval '7 days';
  if pid is null then return; end if;
  update public.liga_tg_links set used_at = now() where code = p_code;
  return query select * from public.liga_tg_bind_sys(pid, p_tg);
end $$;

-- ertalab: bugungi bosqichi bor, to'lagan, Telegram ulangan o'yinchilar
create or replace function public.liga_morning_list()
returns table(tg bigint, first_name text, lang text, stage int, group_code text)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, coalesce(s.lang,'uz'), public.liga_stage_index(g.start_date, public.liga_today()), s.group_code
  from public.safari_players s join public.liga_groups g on g.code = s.group_code
  where s.tg_user_id is not null and g.active and public.liga_player_ok(s.id)
    and public.liga_stage_index(g.start_date, public.liga_today()) is not null
$$;

-- jamoada bugun bosqichni o'ynaganlar soni (guruh xabarlari uchun; kimligi va bali ko'rsatilmaydi)
create or replace function public.liga_today_counts()
returns table(group_code text, played int, total int)
language sql stable security definer set search_path = public as $$
  select g.code,
    count(*) filter (where s.week_id = public.liga_cur_week_id() and s.week_stages ? (public.liga_stage_index(g.start_date, public.liga_today()))::text)::int,
    count(*) filter (where public.liga_player_ok(s.id))::int
  from public.liga_groups g join public.safari_players s on s.group_code = g.code
  where g.active group by g.code
$$;

-- juma 12:00 dan keyin: har o'yinchiga o'z natijasi (o'rni, bali)
create or replace function public.liga_week_personal()
returns table(tg bigint, first_name text, lang text, group_code text, pos int, n int, week_xp int)
language sql stable security definer set search_path = public as $$
  with w as (select public.liga_last_week_id() as wid),
  r as (select r.player_id, r.group_code, r.week_xp,
          rank() over (partition by r.group_code order by r.week_xp desc)::int pos,
          count(*) over (partition by r.group_code)::int n
        from public.liga_week_results r, w where r.week_id = w.wid)
  select s.tg_user_id, s.first_name, coalesce(s.lang,'uz'), s.group_code, r.pos, coalesce(r.n, 0), coalesce(r.week_xp, 0)
  from public.safari_players s join public.liga_groups g on g.code = s.group_code and g.active
  left join r on r.player_id = s.id
  where s.tg_user_id is not null and public.liga_player_ok(s.id)
$$;

revoke all on function public.liga_tg_bind_sys(uuid,bigint), public.liga_tg_link_use_sys(text,bigint), public.liga_morning_list(),
  public.liga_today_counts(), public.liga_week_personal() from public, anon, authenticated;
grant execute on function public.liga_tg_bind_sys(uuid,bigint), public.liga_tg_link_use_sys(text,bigint), public.liga_morning_list(),
  public.liga_today_counts(), public.liga_week_personal() to service_role;
revoke all on function public.liga_me(uuid,text), public.liga_tg_link_code(uuid,text) from public;
grant execute on function public.liga_me(uuid,text), public.liga_tg_link_code(uuid,text) to anon, authenticated, service_role;

-- eslatma ro'yxati jamoa kodi bilan (bot "jamoangizdan N kishi o'ynadi" deb yozishi uchun)
create or replace function public.liga_remind_list2()
returns table(tg bigint, first_name text, lang text, stage int, group_code text)
language sql stable security definer set search_path = public as $$
  select s.tg_user_id, s.first_name, coalesce(s.lang,'uz'), public.liga_stage_index(g.start_date, public.liga_today()), s.group_code
  from public.safari_players s join public.liga_groups g on g.code = s.group_code
  where s.tg_user_id is not null and g.active and public.liga_player_ok(s.id)
    and public.liga_stage_index(g.start_date, public.liga_today()) is not null
    and not (s.week_id = public.liga_cur_week_id() and s.week_stages ? (public.liga_stage_index(g.start_date, public.liga_today()))::text)
$$;
revoke all on function public.liga_remind_list2() from public, anon, authenticated;
grant execute on function public.liga_remind_list2() to service_role;
