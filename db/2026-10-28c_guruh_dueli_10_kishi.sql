-- 2026-10-28c: «4 kishilik duel» → «Guruh dueli»: 2 tadan 10 kishigacha (nomdagi son olib tashlandi)
alter table public.liga_quad_p drop constraint if exists liga_quad_p_seat_check;
alter table public.liga_quad_p add constraint liga_quad_p_seat_check check (seat between 1 and 10);
create or replace function public.liga_quad_max() returns int language sql immutable as $$ select 10 $$;
