-- 2026-10-20b · 1) Kunlik limitlar olib tashlandi: duel (kuniga 20) va jonli duel (kuniga 30) cheklovi yo'q.
--                  Faqat avtomatik spamdan himoya qoladi: 2 daqiqada 15 tadan ko'p yaratib bo'lmaydi.
--               2) Qurilmadagi xatolar jurnali (liga_client_err) — bo'sh ekran / ochilmaslik sababini ko'rish uchun.
--               3) Ijtimoiy soliq 6520 da: bank savollari tuzatildi (ma'lumot: 2026-10-20_ijtimoiy_6520_data.json, 18 ta savol).

create or replace function public.liga_duel_create(p_id uuid, p_token text, p_lang text default 'uz')
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if (select count(*) from public.liga_duels where a_id = p_id and created_at > now() - interval '2 minutes') >= 15 then raise exception 'too_many'; end if;
  loop c := public.liga_short_code(6); exit when not exists (select 1 from public.liga_duels where code = c); end loop;
  insert into public.liga_duels(code, a_id, lang) values (c, p_id, coalesce(p_lang,'uz'));
  return c;
end $$;

create or replace function public.liga_live_create(p_id uuid, p_token text, p_lang text default 'uz')
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if (select count(*) from public.liga_live where a_id = p_id and created_at > now() - interval '2 minutes') >= 15 then raise exception 'too_many'; end if;
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where code = c); end loop;
  insert into public.liga_live(code, a_id, lang, qids, a_seen)
    values (c, p_id, case when p_lang = 'ru' then 'ru' else 'uz' end, public.liga_draw_fresh(public.liga_all_pools(), 'live|' || c, 4, 3, 3, 0, array[p_id]), now());
  return c;
end $$;

create or replace function public.liga_live_create_sys(p_tg bigint, p_lang text default 'uz')
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid; plang text; c text;
begin
  select id, lang into pid, plang from public.safari_players where tg_user_id = p_tg order by last_active desc nulls last limit 1;
  if pid is null then return jsonb_build_object('err', 'no_player'); end if;
  if not public.liga_player_ok(pid) then return jsonb_build_object('err', 'unpaid'); end if;
  if exists (select 1 from public.liga_live l join public.liga_group_posts g on g.code = l.code
              where l.a_id = pid and l.status = 'wait' and l.b_id is null and l.created_at > now() - interval '30 minutes') then
    return jsonb_build_object('err', 'open_exists');
  end if;
  if (select count(*) from public.liga_live where a_id = pid and created_at > now() - interval '2 minutes') >= 15 then return jsonb_build_object('err', 'too_many'); end if;
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where code = c); end loop;
  insert into public.liga_live(code, a_id, lang, qids, a_seen)
    values (c, pid, case when plang = 'ru' then 'ru' else 'uz' end, public.liga_draw_fresh(public.liga_all_pools(), 'live|' || c, 4, 3, 3, 0, array[pid]), now());
  return jsonb_build_object('code', c, 'name', public.liga_pname(pid));
end $$;

-- qurilma xatolari
create table if not exists public.liga_client_err(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  msg text not null, stack text, ua text, place text, tg text, ver text
);
alter table public.liga_client_err enable row level security;
create index if not exists liga_client_err_at on public.liga_client_err(at desc);

create or replace function public.liga_client_err(p_msg text, p_stack text default null, p_ua text default null, p_where text default null, p_tg text default null, p_ver text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_msg), '') = '' then return; end if;
  -- himoya: daqiqasiga ko'pi bilan 120 ta yozuv, 30 kundan eskilari o'chadi
  if (select count(*) from public.liga_client_err where at > now() - interval '1 minute') >= 120 then return; end if;
  insert into public.liga_client_err(msg, stack, ua, place, tg, ver)
  values (left(p_msg, 400), left(p_stack, 1500), left(p_ua, 300), left(p_where, 200), left(p_tg, 60), left(p_ver, 30));
  delete from public.liga_client_err where at < now() - interval '30 days';
end $$;
grant execute on function public.liga_client_err(text, text, text, text, text, text) to anon, authenticated;
