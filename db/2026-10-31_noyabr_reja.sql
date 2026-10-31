-- 2026-10-31 · Noyabr bosqichi (02–30.11.2026, 21 ish kuni) + Sovrinli musobaqa tanaffusi
-- 1) Kunlik reja: content/nov.asc (shifrlangan, kalit — liga_bot_config.bank_key). Har kuni yangi mavzu, daraja 1 → 13.
--    Odatda 15 provodka + 5 savol; 19.11 — 10 + 10 (TMZ hisob-kitoblari), 26.11 — 8 + 12 (moliyaviy hisobot).
--    Yuklash: select net.http_get('https://raw.githubusercontent.com/murtozoabdubannonov90-byte/liga/main/content/nov.asc');
--             select public.liga_plan_load_sys(content) from net._http_response where id = <so'rov id>;
-- 2) Rejada n_pv / n_other endi manbadan olinadi (bo'lmasa 15/5).
-- 3) Sovrinli musobaqa tanaffusda: px_on = off, e'lon/taklif cronlari o'chirilgan. Oktabr g'oliblari
--    liga-mashq-oy (01.11 00:10) da odatdagidek liga_px_win ga yoziladi — u cron yoqiq qoldi.

create or replace function public.liga_plan_load_sys(p_asc text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare j jsonb; k text; np int := 0; nq int := 0; x jsonb;
begin
  select value into k from public.liga_bot_config where key = 'bank_key';
  j := convert_from(extensions.pgp_sym_decrypt_bytea(extensions.dearmor(p_asc), k), 'UTF8')::jsonb;
  for x in select * from jsonb_array_elements(j->'questions') loop
    insert into public.liga_bank(id, pool, t, uz, ru, dt, kt, a, active)
    values (x->>'id', x->>'pool', x->>'t', x->'uz', x->'ru', x->>'dt', x->>'kt', (x->>'a')::numeric, true)
    on conflict (id) do update set pool = excluded.pool, t = excluded.t, uz = excluded.uz, ru = excluded.ru,
      dt = excluded.dt, kt = excluded.kt, a = excluded.a, active = true;
    nq := nq + 1;
  end loop;
  for x in select * from jsonb_array_elements(j->'plans') loop
    insert into public.liga_day_plan(day, pool, level, icon, title, story, theory, n_pv, n_other)
    values ((x->>'day')::date, x->>'pool', (x->>'level')::int, x->>'icon', x->'title', x->'story', x->'theory',
            coalesce((x->>'n_pv')::int, 15), coalesce((x->>'n_other')::int, 5))
    on conflict (day) do update set pool = excluded.pool, level = excluded.level, icon = excluded.icon,
      title = excluded.title, story = excluded.story, theory = excluded.theory,
      n_pv = excluded.n_pv, n_other = excluded.n_other;
    np := np + 1;
  end loop;
  return jsonb_build_object('plans', np, 'questions', nq);
end $$;
revoke all on function public.liga_plan_load_sys(text) from public, anon, authenticated;

-- Sovrinli musobaqa — tanaffus (qayta yoqish: px_on = 'on' va cronlarni active := true)
update public.liga_bot_config set value = 'off' where key = 'px_on';
select cron.alter_job(jobid, active := false) from cron.job
 where jobname in ('liga-musobaqa-2soat', 'liga-musobaqa-elon', 'liga-musobaqa-taklif-1', 'liga-musobaqa-taklif-2', 'liga-mashq-elon');
