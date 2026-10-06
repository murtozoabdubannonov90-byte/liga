-- 2026-10-06b: juftlik dueli — to'liq tasodifiy juftlar, ertalab hammaga jadval, 5 daqiqa oldin eslatma
alter table public.liga_day_duels add column if not exists notified_5 boolean not null default false;

-- juftlash: to'liq tasodifiy (bot 09:00 da chaqiradi; takror chaqirilsa — mavjud juftlar qaytadi)
create or replace function public.liga_day_pair2_sys()
returns table(group_code text, code text, slot time, player uuid, tg bigint, lang text, my_name text, opp_name text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; slots time[]; i int; c text; t time; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id);
      if coalesce(array_length(ids, 1), 0) >= 2 then
        select array_agg(x order by random()) into slots from (
          select generate_series(td + case when extract(isodow from td) = 5 then '09:30'::time else '10:00'::time end,
                                 td + case when extract(isodow from td) = 5 then '11:00'::time else '16:00'::time end, interval '30 minutes')::time x) s;
        i := 1;
        while i + 1 <= array_length(ids, 1) loop
          t := slots[1 + ((i / 2) % array_length(slots, 1))];
          loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where liga_live.code = c); end loop;
          insert into public.liga_live(code, a_id, b_id, lang, qids, kind, win_from, win_to)
            values (c, ids[i], ids[i + 1], (select case when sp.lang = 'ru' then 'ru' else 'uz' end from public.safari_players sp where sp.id = ids[i]),
                    public.liga_draw(public.liga_all_pools(), 'day|' || c, 10, 0, 0, 0), 'day',
                    (td + t) at time zone 'Asia/Tashkent', (td + t + interval '1 hour') at time zone 'Asia/Tashkent');
          insert into public.liga_day_duels(day, group_code, code, a_id, b_id, slot) values (td, g.code, c, ids[i], ids[i + 1], t);
          i := i + 2;
        end loop;
        isnew := true;
      end if;
    end if;
    return query
      select g.code, d.code, d.slot, s.id, s.tg_user_id, coalesce(s.lang, 'uz'),
        trim(coalesce(s.first_name,'') || ' ' || left(coalesce(s.last_name,''),1) || '.'),
        trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.'), isnew
      from public.liga_day_duels d
      join public.safari_players s on s.id in (d.a_id, d.b_id)
      join public.safari_players o on o.id = case when s.id = d.a_id then d.b_id else d.a_id end
      where d.day = td and d.group_code = g.code
      order by d.slot;
  end loop;
end $$;

-- eslatmalar: soatdan 5 daqiqa oldin (kind='5') va soati kelganda (kind='start')
create or replace function public.liga_day_duel_due2_sys()
returns table(kind text, code text, slot time, tg bigint, lang text, opp_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with five as (
    update public.liga_day_duels d set notified_5 = true
    where d.day = public.liga_today() and not d.notified_5 and not d.notified_start
      and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '6 minutes'
      and (d.day + d.slot) at time zone 'Asia/Tashkent' > now() + interval '1 minute'
    returning 'five'::text k, d.code, d.slot, d.a_id, d.b_id),
  st as (
    update public.liga_day_duels d set notified_start = true, notified_5 = true
    where d.day = public.liga_today() and not d.notified_start
      and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '1 minute'
      and (d.day + d.slot + interval '1 hour') at time zone 'Asia/Tashkent' > now()
    returning 'start'::text k, d.code, d.slot, d.a_id, d.b_id),
  allx as (select * from five union all select * from st)
  select allx.k, allx.code, allx.slot, s.tg_user_id, coalesce(s.lang, 'uz'),
    trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.')
  from allx join public.safari_players s on s.id in (allx.a_id, allx.b_id)
  join public.safari_players o on o.id = case when s.id = allx.a_id then allx.b_id else allx.a_id end
  where s.tg_user_id is not null;
end $$;

create or replace function public.liga_day_duel_tick() returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.liga_day_duels d where d.day = public.liga_today() and (
       (not d.notified_5 and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '6 minutes')
    or (not d.notified_start and (d.day + d.slot) at time zone 'Asia/Tashkent' <= now() + interval '1 minute'))
    and (d.day + d.slot + interval '1 hour') at time zone 'Asia/Tashkent' > now()) then
    perform public.liga_bot_call('duel_due');
  end if;
end $$;

-- ilova: jamoaning bugungi duellar jadvali (hamma ko'radi)
create or replace function public.liga_day_duels_list(p_id uuid)
returns table(slot text, a_name text, b_name text, a_pts int, b_pts int, status text, note text, mine boolean)
language plpgsql security definer set search_path = public as $$
declare g text := public.liga_my_group(p_id); r record;
begin
  for r in select d.code from public.liga_day_duels d where d.day = public.liga_today() and d.group_code = g loop
    perform public.liga_live_tick(r.code);
  end loop;
  return query select to_char(d.slot, 'HH24:MI'),
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.a_id),
    (select trim(coalesce(x.first_name,'') || ' ' || left(coalesce(x.last_name,''),1) || '.') from public.safari_players x where x.id = d.b_id),
    l.a_pts, l.b_pts, l.status, l.note, p_id in (d.a_id, d.b_id)
  from public.liga_day_duels d join public.liga_live l on l.code = d.code
  where d.day = public.liga_today() and d.group_code = g order by d.slot;
end $$;

revoke all on function public.liga_day_pair2_sys(), public.liga_day_duel_due2_sys() from public, anon, authenticated;
grant execute on function public.liga_day_pair2_sys(), public.liga_day_duel_due2_sys() to service_role;
grant execute on function public.liga_day_duels_list(uuid) to anon, authenticated;
-- cron har 5 daqiqada: 09:00–16:59 (04–11 UTC); juma 09:30 slot uchun ham yetadi
