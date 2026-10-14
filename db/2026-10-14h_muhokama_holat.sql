-- 2026-10-14 · Muhokama taklifi: har bir ishtirokchi bo'yicha natija saqlanadi (yetkazildimi, guruhdami).
-- discuss_status: in — guruhda; sent — taklif yetib bordi; fail — yetmadi (botni ochmagan yoki bloklagan); kicked — guruhdan chiqarilgan.
alter table public.safari_players add column if not exists discuss_status text;

create or replace function public.liga_discuss_mark2_sys(p_tg bigint, p_status text)
returns void language sql security definer set search_path = public as $$
  update public.safari_players set discuss_sent_at = now(), discuss_status = coalesce(p_status, discuss_status) where tg_user_id = p_tg;
$$;

-- hamma Telegram'li ishtirokchilar (holatni tekshirish va qayta yuborish uchun)
create or replace function public.liga_discuss_all_sys()
returns table(tg bigint, lang text, first_name text, status text) language sql security definer set search_path = public as $$
  select distinct on (s.tg_user_id) s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name, s.discuss_status
    from public.safari_players s where s.tg_user_id is not null
   order by s.tg_user_id, s.last_active desc nulls last;
$$;

revoke all on function public.liga_discuss_mark2_sys(bigint, text) from public, anon, authenticated;
revoke all on function public.liga_discuss_all_sys() from public, anon, authenticated;
grant execute on function public.liga_discuss_mark2_sys(bigint, text) to service_role;
grant execute on function public.liga_discuss_all_sys() to service_role;
