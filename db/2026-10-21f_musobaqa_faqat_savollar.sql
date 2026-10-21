-- 2026-10-21f · Sovrinli musobaqa: faqat savollar. Vazifa bonuslari (liga_px_quest) reytingga qo'shilmaydi va yangisi yozilmaydi;
-- ilovada «Vazifalar» va «Yutuqlar» bo'limlari olib tashlandi. Reyting = o'yinlarda to'g'ri javoblar uchun olingan ballar yig'indisi
-- (to'g'ri javob 10 ball + ketma-ketlik bonusi +2 … +10; xato — 0). Oldingi 74 ta vazifa yozuvi (2 750 ball) bazada qoladi, lekin hisobga kirmaydi.

create or replace function public.liga_px_month_pts(p_group text, p_mon text)
returns table(player_id uuid, pts bigint, games bigint)
language sql stable security definer set search_path = public as $$
  select x.player_id, sum(x.score)::bigint, count(*)::bigint
  from public.liga_px_sess x where x.group_code = p_group and x.mon = p_mon and x.done_n > 0
  group by x.player_id
$$;

create or replace function public.liga_px_board(p_id uuid, p_scope text default 'month')
returns table(pos integer, name text, pts bigint, games bigint, me boolean, ok boolean)
language sql stable security definer set search_path = public as $$
  with g as (select coalesce(public.liga_my_group(p_id), 'ASOSIY') code),
  per as (select case p_scope when 'day' then public.liga_today()
                              when 'week' then public.liga_today() - (extract(isodow from public.liga_today())::int - 1)
                              else date_trunc('month', public.liga_today())::date end d0),
  agg as (
    select x.player_id, sum(x.score)::bigint pts, count(*)::bigint games
    from public.liga_px_sess x, g, per where x.group_code = g.code and x.day >= per.d0 and x.done_n > 0
    group by x.player_id having sum(x.score) > 0),
  r as (select a.*, (rank() over (order by a.pts desc))::int pos from agg a)
  select r.pos, public.liga_px_pname(r.player_id), r.pts, r.games, r.player_id = p_id, public.liga_player_ok(r.player_id)
    from r where r.pos <= 50 or r.player_id = p_id order by r.pos, r.games desc
$$;

-- vazifalar bekor: yangi bonus yozilmaydi
create or replace function public.liga_px_claim(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$ select '[]'::jsonb $$;

create or replace function public.liga_px_me(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g text; v_mon text := public.liga_px_mon(); d date := public.liga_today(); tot record; mp bigint; rk int; n int; streak int := 0; dd date;
        ach jsonb; fund bigint; v_sp int[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select coalesce(sp.group_code, 'ASOSIY') into g from public.safari_players sp where sp.id = p_id;
  select count(*) filter (where public.liga_px_done(x)) games, coalesce(sum(right_n), 0) rights, coalesce(sum(done_n), 0) answers,
         coalesce(max(score) filter (where kind = 'pv'), 0) b_pv, coalesce(max(score) filter (where kind = 'acc'), 0) b_acc,
         coalesce(max(score) filter (where kind = 'side'), 0) b_side, coalesce(max(right_n), 0) max_right, coalesce(max(best_combo), 0) max_combo,
         count(*) filter (where public.liga_px_done(x) and right_n >= 10 and done_n = right_n) clean,
         count(*) filter (where public.liga_px_done(x) and day = d) today_games, coalesce(sum(score) filter (where day = d), 0) today_pts
    into tot from public.liga_px_sess x where x.player_id = p_id;
  select m.pts into mp from public.liga_px_month_pts(g, v_mon) m where m.player_id = p_id;
  select count(*) + 1 into rk from public.liga_px_month_pts(g, v_mon) m where m.pts > coalesce(mp, 0);
  select count(*) into n from public.liga_px_month_pts(g, v_mon);
  dd := case when exists (select 1 from public.liga_px_sess where player_id = p_id and day = d and done_n > 0) then d else d - 1 end;
  while exists (select 1 from public.liga_px_sess where player_id = p_id and day = dd and done_n > 0) and streak < 400 loop streak := streak + 1; dd := dd - 1; end loop;
  ach := '[]'::jsonb;
  fund := public.liga_px_fund(g, v_mon); v_sp := public.liga_px_split();
  return jsonb_build_object('mon', v_mon, 'secs', public.liga_px_cfg('px_secs', '60')::int, 'on', public.liga_px_cfg('px_on', 'on') = 'on',
    'today', jsonb_build_object('games', tot.today_games, 'pts', tot.today_pts),
    'month', jsonb_build_object('pts', coalesce(mp, 0), 'rank', case when coalesce(mp, 0) > 0 then rk end, 'n', n),
    'total', jsonb_build_object('games', tot.games, 'rights', tot.rights, 'answers', tot.answers, 'best', jsonb_build_object('pv', tot.b_pv, 'acc', tot.b_acc, 'side', tot.b_side)),
    'streak', streak, 'quests', '[]'::jsonb, 'ach', ach,
    'fund', jsonb_build_object('amount', fund, 'split', to_jsonb(v_sp), 'prizes', (select coalesce(jsonb_agg(fund * u.x / 100 order by u.o), '[]') from unnest(v_sp) with ordinality u(x, o))),
    'eligible', public.liga_player_ok(p_id));
end $$;
