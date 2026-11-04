-- 2026-11-04b: liga egasi kubokda doim qatnashadi.
-- Avval: son toq bo'lsa egasi chetda turardi (03.11 dan beri 547 kishi — egasi har kuni chetda, duel ham, bot xabari ham yo'q edi).
-- Endi: son toq bo'lsa eng uzoq vaqt ilovaga kirmagan oddiy o'yinchi (egasi emas) shu kuni chetda qoladi.
create or replace function public.liga_cup_start_sys()
 returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
 language plpgsql security definer set search_path to 'public'
as $function$
declare td date := public.liga_today(); g record; ids uuid[]; own uuid; idle uuid; i int; n int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    perform pg_advisory_xact_lock(hashtext('liga_cup|' || g.code));
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      if n % 2 = 1 then
        own := public.liga_owner_id(g.code);
        if own is not null and not (own = any(ids)) then
          ids := ids || own;
        else
          select s.id into idle from public.safari_players s
            where s.id = any(ids) and s.id is distinct from own
            order by s.last_active asc nulls first, random() limit 1;
          if idle is not null then ids := array_remove(ids, idle); end if;
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
end $function$;
