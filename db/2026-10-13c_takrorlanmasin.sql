-- 2026-10-13 · Hafta davomida savollar takrorlanmasin
-- Duel, jonli duel va kubok duellari savol tanlaganda o'yinchi(lar) shu hafta (dushanbadan) ko'rgan savollar oxiriga suriladi:
-- avval hali ko'rilmaganlari olinadi, faqat yetmay qolsa ko'rilganidan to'ldiriladi. Kunlik bosqich (reja) savollari alohida
-- hovuzda va har kun o'ziniki — ular bilan kesishmaydi.

create or replace function public.liga_week_start() returns timestamptz
language sql stable as $$ select (date_trunc('week', now() at time zone 'Asia/Tashkent')) at time zone 'Asia/Tashkent' $$;

create or replace function public.liga_seen_week(p_players uuid[])
returns table(qid text) language sql stable security definer set search_path = public as $$
  select a.qid from public.liga_run_ans a join public.liga_runs r on r.id = a.run_id
   where r.player_id = any(p_players) and r.started_at >= public.liga_week_start()
  union
  select unnest(l.qids) from public.liga_live l
   where (l.a_id = any(p_players) or l.b_id = any(p_players)) and l.created_at >= public.liga_week_start()
$$;
revoke all on function public.liga_seen_week(uuid[]) from public, anon, authenticated;

create or replace function public.liga_draw_fresh(p_pools text[], p_seed text, p_pv integer, p_calc integer, p_mc integer, p_other integer, p_players uuid[])
returns text[] language sql stable security definer set search_path = public as $$
  with seen as (select qid from public.liga_seen_week(p_players))
  select coalesce(array_agg(id order by md5(id || p_seed || 'tartib')), '{}') from (
    (select id from public.liga_bank where pool = any(p_pools) and active and t = 'pv'
       order by (id in (select qid from seen)), md5(id || p_seed) limit p_pv)
    union all (select id from public.liga_bank where pool = any(p_pools) and active and t = 'calc'
       order by (id in (select qid from seen)), md5(id || p_seed) limit p_calc)
    union all (select id from public.liga_bank where pool = any(p_pools) and active and t = 'mc'
       order by (id in (select qid from seen)), md5(id || p_seed) limit p_mc)
    union all (select id from public.liga_bank where pool = any(p_pools) and active and t <> 'pv'
       order by (id in (select qid from seen)), md5(id || p_seed || 'x') limit p_other)) x
$$;
revoke all on function public.liga_draw_fresh(text[], text, integer, integer, integer, integer, uuid[]) from public, anon, authenticated;

-- kubok dueli: ikkala o'yinchi shu hafta ko'rmagan 15 provodka
create or replace function public.liga_cup_new_duel(p_day date, p_group text, p_round integer, p_pos integer, p_a uuid, p_b uuid, p_slot time without time zone)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where liga_live.code = c); end loop;
  insert into public.liga_live(code, a_id, b_id, lang, qids, kind, win_from, win_to)
    values (c, p_a, p_b, (select case when sp.lang = 'ru' then 'ru' else 'uz' end from public.safari_players sp where sp.id = p_a),
            public.liga_draw_fresh(public.liga_all_pools(), 'day|' || c, 15, 0, 0, 0, array[p_a, p_b]), 'day',
            (p_day + p_slot) at time zone 'Asia/Tashkent', (p_day + p_slot + interval '30 minutes') at time zone 'Asia/Tashkent');
  insert into public.liga_day_duels(day, group_code, code, a_id, b_id, slot, round, pos, notified_pair)
    values (p_day, p_group, c, p_a, p_b, p_slot, p_round, p_pos, p_round = 1);
  return c;
end $$;

-- jonli duel: yaratuvchi shu hafta ko'rmagan savollar
create or replace function public.liga_live_create(p_id uuid, p_token text, p_lang text DEFAULT 'uz'::text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if (select count(*) from public.liga_live where a_id = p_id and created_at > now() - interval '1 day') >= 30 then raise exception 'too_many'; end if;
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where code = c); end loop;
  insert into public.liga_live(code, a_id, lang, qids, a_seen)
    values (c, p_id, case when p_lang = 'ru' then 'ru' else 'uz' end, public.liga_draw_fresh(public.liga_all_pools(), 'live|' || c, 4, 3, 3, 0, array[p_id]), now());
  return c;
end $$;

-- oddiy duel: birinchi o'ynagan uchun shu hafta ko'rmaganlari; ikkinchisi AYNAN shu savollarni oladi (adolat uchun)
create or replace function public.liga_duel_start(p_id uuid, p_token text, p_code text, p_lang text DEFAULT 'uz'::text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.liga_duels; rid uuid; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  select * into d from public.liga_duels where code = upper(trim(p_code)) for update;
  if d.code is null then raise exception 'not_found'; end if;
  if d.a_id = p_id then
    if d.a_score is not null then raise exception 'already_done'; end if;
  else
    if d.b_id is not null and d.b_id <> p_id then raise exception 'duel_taken'; end if;
    if d.b_score is not null then raise exception 'already_done'; end if;
    if d.created_at < now() - interval '7 days' then raise exception 'duel_expired'; end if;
    update public.liga_duels set b_id = p_id where code = d.code and b_id is null;
  end if;
  select id into rid from public.liga_runs where kind = 'duel' and player_id = p_id and ref = d.code;
  if rid is null then
    select r.qids into q from public.liga_runs r where r.kind = 'duel' and r.ref = d.code and r.player_id <> p_id limit 1;
    if q is null then
      q := public.liga_draw_fresh(public.liga_all_pools(), 'duel|' || d.code, 4, 3, 3, 0, array_remove(array[d.a_id, d.b_id, p_id], null));
    end if;
    rid := public.liga_run_new('duel', p_id, d.code, null, p_lang, q);
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;
