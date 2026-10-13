-- 2026-10-13 · Yangi qo'shilganlarga boshida bepul davr (odam ko'payishi uchun)
-- free_from (10.10 — sinov davrida qo'shilgan, hali to'lamagan G'ofur M. ham kiradi) dan keyin ro'yxatdan o'tgan har bir o'yinchi ro'yxatdan o'tgan kunidan boshlab free_days kun bepul o'ynaydi.
-- O'chirish: update liga_bot_config set value = '0' where key = 'free_days';
-- Bepul davrda to'lov qilsa, obuna bepul davr tugagan kundan uzaytiriladi (kun yo'qolmaydi).

insert into public.liga_bot_config(key, value) values ('free_days', '30') on conflict (key) do nothing;
insert into public.liga_bot_config(key, value) values ('free_from', '2026-10-10') on conflict (key) do nothing;

create or replace function public.liga_free_days()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce((select value::int from public.liga_bot_config where key = 'free_days'), 0))
$$;

-- amaldagi obuna tugash sanasi: to'langan sana, eski a'zolar uchun 04.10 gacha, yangilar uchun bepul davr — qaysi biri kech bo'lsa
create or replace function public.liga_eff_until(p_until date, p_created timestamptz)
returns date language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce(p_until, case when p_created < timestamptz '2026-10-01 18:00+05' then date '2026-10-04' end),
    case when public.liga_free_days() > 0
          and p_created >= coalesce((select value::date from public.liga_bot_config where key = 'free_from'), date '2999-01-01')::timestamp at time zone 'Asia/Tashkent'
         then (p_created at time zone 'Asia/Tashkent')::date + public.liga_free_days() - 1 end)
$$;

grant execute on function public.liga_free_days() to anon, authenticated;
