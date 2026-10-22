-- Hisobchi Liga: bosqich har ish kuni 09:00–18:00 (avval 17:00), liga juma 18:00 da yakunlanadi.
-- Hafta identifikatori yozuvi o'zgarmaydi ("juma T07:00"), faqat almashish payti 12:00 UTC → 13:00 UTC.
-- Kubok finali 17:00 da qoladi.

create or replace function public.liga_close_hour(d date) returns integer language sql immutable as $$ select 18 $$;

create or replace function public.liga_cur_week_id() returns text language sql stable as $$
  select to_char(case when b <= (now() at time zone 'UTC') then b + interval '7 days' else b end - interval '6 hours', 'YYYY-MM-DD"T"HH24:MI')
  from (select date_trunc('week', now() at time zone 'UTC') + interval '4 days 13 hours' as b) x
$$;

create or replace function public.liga_last_week_id() returns text language sql stable set search_path to 'public' as $$
  select to_char(case when b > (now() at time zone 'UTC') then b - interval '7 days' else b end - interval '6 hours', 'YYYY-MM-DD"T"HH24:MI')
  from (select date_trunc('week', now() at time zone 'UTC') + interval '4 days 13 hours' as b) x
$$;

-- cron (UTC): «1 soat qoldi» 17:00, kun oxiri 18:00, juma ogohlantirish 17:00, liga yakuni 18:01, darajalar 18:10, SMS 17:59 gacha
select cron.alter_job((select jobid from cron.job where jobname = 'liga-eslatma'),   schedule := '0 12 * * 1-5');
select cron.alter_job((select jobid from cron.job where jobname = 'liga-kun-oxiri'), schedule := '0 13 * * 1-5');
select cron.alter_job((select jobid from cron.job where jobname = 'liga-juma-11'),   schedule := '0 12 * * 5');
select cron.alter_job((select jobid from cron.job where jobname = 'liga-tugadi'),    schedule := '1 13 * * 5');
select cron.alter_job((select jobid from cron.job where jobname = 'liga-darajalar'), schedule := '10 13 * * 5');

-- SMS «bosqich bajarilmagan» eslatmasi: 16:00–17:30 (avval 15:00–16:30)
do $$ begin
  execute replace(pg_get_functiondef('public.liga_sms_due'::regproc), 'h >= 15 and h < 16.5', 'h >= 16 and h < 17.5');
end $$;
