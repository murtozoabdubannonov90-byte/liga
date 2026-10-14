-- 2026-10-14 · Muhokama guruhida reklamaga qarshi: bot reklama xabarini o'chiradi va ogohlantiradi;
-- 3-marta takrorlagan odam 24 soatga yozishdan cheklanadi. Hisob 7 kun ichida yangilanadi.
create table if not exists public.liga_discuss_strikes(
  tg bigint primary key,
  n int not null default 0,
  last_at timestamptz not null default now()
);
alter table public.liga_discuss_strikes enable row level security;

create or replace function public.liga_discuss_strike_sys(p_tg bigint)
returns int language plpgsql security definer set search_path = public as $$
declare k int;
begin
  insert into public.liga_discuss_strikes(tg, n, last_at) values (p_tg, 1, now())
  on conflict (tg) do update set
    n = case when public.liga_discuss_strikes.last_at < now() - interval '7 days' then 1 else public.liga_discuss_strikes.n + 1 end,
    last_at = now()
  returning n into k;
  return k;
end $$;
revoke all on function public.liga_discuss_strike_sys(bigint) from public, anon, authenticated;
grant execute on function public.liga_discuss_strike_sys(bigint) to service_role;
