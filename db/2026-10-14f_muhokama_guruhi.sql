-- 2026-10-14 · Liga ishtirokchilari uchun Telegram muhokama guruhi.
-- Telegram cheklovi: bot guruh ocholmaydi va odamni guruhga o'zi qo'sha olmaydi.
-- Shuning uchun: administrator guruhni o'zi ochadi, botni admin qiladi va guruhda /muhokama yozadi →
-- bot taklif havolasi yaratadi va har bir ishtirokchiga shaxsan «Guruhga qo'shilish» tugmasini yuboradi.
-- Yangi qo'shilganlarga bot har kuni ertalab yuboradi; havola ilovaning bosh sahifasida ham turadi.

alter table public.safari_players add column if not exists discuss_sent_at timestamptz;

-- bot: guruh va havolani saqlash (liga_bot_config: discuss_chat, discuss_link)
create or replace function public.liga_discuss_set_sys(p_chat bigint, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.liga_bot_config(key, value) values ('discuss_chat', p_chat::text)
    on conflict (key) do update set value = excluded.value;
  insert into public.liga_bot_config(key, value) values ('discuss_link', p_link)
    on conflict (key) do update set value = excluded.value;
  update public.safari_players set discuss_sent_at = null where discuss_sent_at is not null;   -- yangi guruh — hammaga qayta taklif
end $$;

-- bot: taklif yuborilmagan, Telegram'i ulangan ishtirokchilar
create or replace function public.liga_discuss_targets_sys(p_limit int default 300)
returns table(tg bigint, lang text, first_name text) language sql security definer set search_path = public as $$
  select distinct on (s.tg_user_id) s.tg_user_id, coalesce(s.lang, 'uz'), s.first_name
    from public.safari_players s
   where s.tg_user_id is not null and s.discuss_sent_at is null
   order by s.tg_user_id, s.last_active desc nulls last
   limit greatest(1, least(p_limit, 1000));
$$;

create or replace function public.liga_discuss_mark_sys(p_tg bigint)
returns void language sql security definer set search_path = public as $$
  update public.safari_players set discuss_sent_at = now() where tg_user_id = p_tg;
$$;

-- ilova: muhokama guruhi havolasi (faqat ro'yxatdan o'tgan ishtirokchiga)
create or replace function public.liga_discuss_link(p_id uuid, p_token text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then return null; end if;
  return (select value from public.liga_bot_config where key = 'discuss_link');
end $$;

revoke all on function public.liga_discuss_set_sys(bigint, text) from public, anon, authenticated;
revoke all on function public.liga_discuss_targets_sys(int) from public, anon, authenticated;
revoke all on function public.liga_discuss_mark_sys(bigint) from public, anon, authenticated;
grant execute on function public.liga_discuss_set_sys(bigint, text) to service_role;
grant execute on function public.liga_discuss_targets_sys(int) to service_role;
grant execute on function public.liga_discuss_mark_sys(bigint) to service_role;
revoke all on function public.liga_discuss_link(uuid, text) from public;
grant execute on function public.liga_discuss_link(uuid, text) to anon, authenticated, service_role;
