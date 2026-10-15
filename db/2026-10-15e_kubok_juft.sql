-- 2026-10-15 · Kubok 1-raundi doim juft: ishtirokchilar soni toq bo'lsa, eng oxirgi qo'shilgan o'yinchi o'sha kuni kubokda qatnashmaydi
-- (kunlik bosqichda odatdagidek o'ynaydi) va unga «kubokda ertadan qatnashasiz» deb xabar boriladi.
create table if not exists public.liga_day_bench(
  day date not null, group_code text not null, player_id uuid not null,
  primary key (day, group_code, player_id)
);
alter table public.liga_day_bench enable row level security;

create or replace function public.liga_cup_start_sys()
returns table(group_code text, code text, slot time without time zone, player uuid, tg bigint, lang text, my_name text, opp_name text, stage text, fresh boolean)
language plpgsql security definer set search_path = public as $$
declare td date := public.liga_today(); g record; ids uuid[]; last_id uuid; i int; n int; nd int; isnew boolean;
begin
  if extract(isodow from td) > 5 then return; end if;
  for g in select lg.code from public.liga_groups lg where lg.active loop
    isnew := false;
    perform pg_advisory_xact_lock(hashtext('liga_cup|' || g.code));
    if not exists (select 1 from public.liga_day_duels x where x.day = td and x.group_code = g.code) then
      select array_agg(s.id order by random()) into ids from public.safari_players s
        where s.group_code = g.code and s.last_active > now() - interval '7 days' and public.liga_player_ok(s.id);
      n := coalesce(array_length(ids, 1), 0);
      -- toq bo'lsa — eng oxirgi ro'yxatdan o'tgan kishi bugun kubokda qatnashmaydi
      if n % 2 = 1 and n >= 3 then
        select s.id into last_id from public.safari_players s where s.id = any(ids) order by s.created_at desc nulls last, s.id desc limit 1;
        ids := array_remove(ids, last_id);
        insert into public.liga_day_bench(day, group_code, player_id) values (td, g.code, last_id) on conflict do nothing;
        n := n - 1;
      end if;
      if n >= 2 then
        nd := n / 2;
        i := 1;
        while i <= nd loop
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

-- bot: bugun kubokdan tashqarida qolganlar
create or replace function public.liga_cup_bench_sys()
returns table(group_code text, player uuid, tg bigint, lang text, name text)
language sql stable security definer set search_path = public as $$
  select b.group_code, b.player_id, s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name
  from public.liga_day_bench b join public.safari_players s on s.id = b.player_id
  where b.day = public.liga_today()
$$;
revoke all on function public.liga_cup_bench_sys() from public, anon, authenticated;
grant execute on function public.liga_cup_bench_sys() to service_role;

-- ilova: o'yinchi bugun kubokdan tashqarida qoldimi
create or replace function public.liga_cup_me2(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (select public.liga_my_group(p_id) code),
  n as (select (select count(*) from public.liga_day_duels d, g where d.day = public.liga_today() and d.group_code = g.code and d.round = 1) * 2
             + (select count(*) from public.liga_day_byes b, g where b.day = public.liga_today() and b.group_code = g.code and b.round = 1) cnt)
  select jsonb_build_object(
    'players', (select cnt from n),
    'bye', exists (select 1 from public.liga_day_byes b, g where b.day = public.liga_today() and b.group_code = g.code and b.player_id = p_id
                     and b.round = (select max(x.round) from public.liga_day_duels x, g g2 where x.day = public.liga_today() and x.group_code = g2.code)),
    'bench', exists (select 1 from public.liga_day_bench b, g where b.day = public.liga_today() and b.group_code = g.code and b.player_id = p_id),
    'table', coalesce((select jsonb_agg(jsonb_build_object('round', t.round, 'stage', t.stage, 'duels', t.duels, 'at', to_char(t.at, 'HH24:MI')) order by t.round)
                       from n, public.liga_cup_timetable(n.cnt::int) t), '[]'::jsonb))
$$;
