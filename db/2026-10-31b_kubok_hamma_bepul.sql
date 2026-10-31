-- 2026-10-31b · 1) Hamma uchun bepul 30.11.2026 gacha (liga_bot_config.free_until, liga_eff_until).
--              2) Kunlik kubok: NOYABRDAN ro'yxatdagi HAMMA o'yinchi qatnashadi (avval — faqat oxirgi 7 kunda faol bo'lganlar).
--                 Toq son bo'lmasligi uchun: son toq chiqsa — liga egasi (free_phones) ro'yxatda bo'lsa o'sha kuni chetda turadi,
--                 bo'lmasa juft qilish uchun qo'shiladi. Oddiy ishtirokchilardan hech kim chetda qolmaydi
--                 (eski «eng oxirgi qo'shilgan bugun kubokda emas» qoidasi bekor).
--                 Keyingi raundlar o'zgarmagan: g'oliblar 2 ning darajasigacha ochko bo'yicha (530 → 265 g'olib → 256 → 128 → … → final).

insert into public.liga_bot_config(key, value) values ('free_until', '2026-11-30')
  on conflict (key) do update set value = excluded.value;

create or replace function public.liga_eff_until(p_until date, p_created timestamp with time zone)
 returns date language sql stable security definer set search_path to 'public' as $function$
  select greatest(
    coalesce(p_until, case when p_created < timestamptz '2026-10-01 18:00+05' then date '2026-10-04' end),
    case when public.liga_free_days() > 0
          and p_created >= coalesce((select value::date from public.liga_bot_config where key = 'free_from'), date '2999-01-01')::timestamp at time zone 'Asia/Tashkent'
         then (p_created at time zone 'Asia/Tashkent')::date + public.liga_free_days() - 1 end,
    (select nullif(value, '')::date from public.liga_bot_config where key = 'free_until'))
$function$;

-- liga egasi (bepul telefon) — toq sonni juftlash uchun
create or replace function public.liga_owner_id(p_group text)
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.safari_players s
  where s.group_code = p_group
    and s.phone = any(string_to_array(coalesce((select value from public.liga_bot_config where key = 'free_phones'), ''), ','))
  order by s.created_at limit 1
$$;
revoke all on function public.liga_owner_id(text) from public, anon, authenticated;

create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; own uuid; i int; n int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    perform pg_advisory_xact_lock(hashtext('liga_cup|' || g.code));
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      -- 2026-11 dan: ro'yxatdagi hamma (obunasi/bepul davri faol) — faollik sharti yo'q
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      if n % 2 = 1 then
        own := public.liga_owner_id(g.code);
        if own is not null and own = any(ids) then ids := array_remove(ids, own);     -- egasi chetda turadi
        elsif own is not null then ids := ids || own;                                 -- egasi juftlik uchun qo'shiladi
        end if;
        n := coalesce(array_length(ids, 1), 0);
      end if;
      if n >= 2 then
        i := 1;
        while i <= n / 2 loop
          perform public.liga_cup_new_duel(td, g.code, 1, i, ids[2 * i - 1], ids[2 * i],
            case when n = 2 then time '17:00' else public.liga_cup_round_time(1) end);
          i := i + 1;
        end loop;
        insert into public.liga_day_cups(day, group_code) values (td, g.code) on conflict do nothing;
        isnew := true;
      end if;
    end if;
    return query
      select g.code, d.code, d.slot, s.id, s.tg_user_id, coalesce(s.lang, 'uz'),
        trim(coalesce(s.first_name,'') || ' ' || left(coalesce(s.last_name,''),1) || '.'),
        trim(coalesce(o.first_name,'') || ' ' || left(coalesce(o.last_name,''),1) || '.'),
        public.liga_cup_rstage(td, g.code, d.round), isnew
      from public.liga_day_duels d
      join public.safari_players s on s.id in (d.a_id, d.b_id)
      join public.safari_players o on o.id = case when s.id = d.a_id then d.b_id else d.a_id end
      where d.day = td and d.group_code = g.code and d.round = (select max(z.round) from public.liga_day_duels z where z.day = td and z.group_code = g.code)
      order by d.slot;
  end loop;
end $$;
