-- 2026-10-15 · Telegram kanal(lar): bot kanalga administrator qilib qo'shilsa, kubok qurasi (juftlar),
-- har raund natijalari, keyingi raund juftlari va kubok g'olibi kanalga ham chiqadi.
create table if not exists public.liga_channels(
  chat_id bigint primary key,
  title text,
  active boolean not null default true,
  added_at timestamptz not null default now()
);
alter table public.liga_channels enable row level security;

-- 256 dan ko'p ishtirokchi (9 raund) bo'lsa ham raundlar ustma-ust tushmasin: 16:00 dan keyin 30 daqiqalik qadam, oxirgisi 16:30
create or replace function public.liga_cup_round_time(p_round int)
returns time language plpgsql immutable as $$
declare t time := time '10:00'; i int := 1;
begin
  while i < p_round loop
    t := case when t >= time '16:00' then t + interval '30 minutes' else t + interval '40 minutes' end;
    if t > time '11:30' and t < time '14:00' then t := time '14:00'; end if;
    i := i + 1;
  end loop;
  return least(t, time '16:30');
end $$;
