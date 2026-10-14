-- Guruhdagi /duel chaqiruvlari ruscha chiqib qolgan edi: til Telegram interfeysidan olinardi.
-- Endi duel tili — chaqiruvchining ilovadagi tili (ru faqat o'yinchi o'zi ruschani tanlagan bo'lsa).
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
  if (select count(*) from public.liga_live where a_id = pid and created_at > now() - interval '1 day') >= 30 then return jsonb_build_object('err', 'too_many'); end if;
  loop c := 'L' || public.liga_short_code(6); exit when not exists (select 1 from public.liga_live where code = c); end loop;
  insert into public.liga_live(code, a_id, lang, qids, a_seen)
    values (c, pid, case when plang = 'ru' then 'ru' else 'uz' end, public.liga_draw_fresh(public.liga_all_pools(), 'live|' || c, 4, 3, 3, 0, array[pid]), now());
  return jsonb_build_object('code', c, 'name', public.liga_pname(pid));
end $$;

-- ruscha bo'lib qolgan duellar o'zbekchaga (ruscha tanlagan o'yinchi yo'q)
update public.liga_live l set lang = 'uz'
 where l.lang = 'ru' and not exists (select 1 from public.safari_players p where p.id = l.a_id and p.lang = 'ru');
