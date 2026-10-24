-- 2026-10-24: botda buxgalteriya savol-javobi (AI + internetdan qidirish)
-- Har bir savol jurnalga yoziladi (limit, xarajat nazorati). O'yin vaqtida bot javob bermaydi.

create table if not exists public.liga_ai_log (
  id bigserial primary key,
  tg bigint not null,
  player_id uuid,
  chat_id bigint,
  q text not null,
  a text,
  status text not null default 'new',   -- new | ok | busy | similar | limit | err
  in_tok integer,
  out_tok integer,
  searches integer,
  ms integer,
  created_at timestamptz not null default now()
);
create index if not exists liga_ai_log_tg_at on public.liga_ai_log (tg, created_at desc);
create index if not exists liga_ai_log_at on public.liga_ai_log (created_at desc);
alter table public.liga_ai_log enable row level security;   -- faqat service role (bot) o'qiydi/yozadi

-- o'yinchi hozir o'yinda bo'lsa — sababini qaytaradi (null = bo'sh)
create or replace function public.liga_ai_busy_sys(p_tg bigint)
returns text language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from public.safari_players where tg_user_id = p_tg limit 1;
  if pid is null then return null; end if;
  if exists (select 1 from public.liga_runs r where r.player_id = pid and r.finished_at is null
             and r.started_at > now() - interval '40 minutes') then return 'stage'; end if;
  if exists (select 1 from public.liga_px_sess s where s.player_id = pid and not s.finished
             and s.day = public.liga_today()) then return 'px'; end if;
  if exists (select 1 from public.liga_live l where (l.a_id = pid or l.b_id = pid) and l.status = 'play'
             and coalesce(l.started_at, l.created_at) > now() - interval '30 minutes') then return 'live'; end if;
  return null;
end $$;
revoke all on function public.liga_ai_busy_sys(bigint) from public, anon, authenticated;
