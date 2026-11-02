-- 2026-11-02: uchta yangi imkoniyat
--   1) «Faktura detektivi» — hujjatdagi xato qatorlarni topish (bank turi 'doc', o'yin turi 'doc'): kuniga 5 ta hujjat,
--      osondan qiyinga (1 + 2 + 2). Javob kaliti serverda, liga baliga qo'shilmaydi — alohida «detektiv bali».
--   2) «Qonun yangiligi testi» — liga_news endi kunlik: har yangilikka 3 ta savol, javoblar serverda tekshiriladi
--      (o'yin turi 'law'). Qoralama (AI yoki rejalashtirilgan vazifa yozadi) → admin botda «Chiqarish» bosadi → ertalab guruhlarga.
--   3) «Rahbar uchun buxgalter tekshiruvi» — botda /tekshiruv: istalgan rahbar test havolasini oladi, nomzod tugatgach
--      batafsil hisobot botga shaxsan keladi. Bepul limit (chk_free, standart 3), admin qo'shimcha ruxsat beradi.
-- Hujjatlar banki: db/2026-11-02b_detektiv_bank.sql (scripts/doc_bank.py). Sinov: db/tests/2026-11-02_detektiv_qonun_tekshiruv_test.sql

-- ================= umumiy: yangi turlar =================
alter table public.liga_bank drop constraint if exists liga_bank_t_check;
alter table public.liga_bank add constraint liga_bank_t_check check (t = any (array['pv', 'mc', 'calc', 'doc']));
alter table public.liga_runs drop constraint if exists liga_runs_kind_check;
alter table public.liga_runs add constraint liga_runs_kind_check check (kind = any (array['stage', 'final', 'duel', 'test', 'doc', 'law']));
create unique index if not exists liga_runs_doc_law on public.liga_runs (kind, player_id, ref) where kind in ('doc', 'law');

-- hujjat javobi: belgilangan qatorlar to'plami kalit bilan aynan bir xil bo'lishi kerak (bo'sh to'plam = «Xato yo'q»)
create or replace function public.liga_doc_keys(p jsonb) returns text
language sql immutable as $$
  select coalesce((select string_agg(x, ',' order by x) from (select distinct x from jsonb_array_elements_text(p) x where x ~ '^[a-z_]{1,12}$') z), '')
$$;
create or replace function public.liga_q_ok(b public.liga_bank, p jsonb) returns boolean
language sql stable as $$
  select coalesce(case b.t
    when 'pv' then p->>'dt' = b.dt and p->>'kt' = b.kt
    when 'mc' then (p->>'pick') ~ '^\d+$' and (p->>'pick')::numeric = b.a
    when 'doc' then jsonb_typeof(p->'pick') = 'array' and public.liga_doc_keys(p->'pick') = coalesce(b.dt, '')
    else regexp_replace(coalesce(p->>'val',''), '[^0-9-]', '', 'g') ~ '^-?\d+$' and regexp_replace(p->>'val', '[^0-9-]', '', 'g')::numeric = b.a end, false)
$$;
-- ilovaga: hujjatning o'zi (kalitsiz)
create or replace function public.liga_q_pub(b public.liga_bank, p_lang text) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('t', b.t, 'q', c->>'q', 'o', case when b.t in ('pv','mc') then c->'o' end, 'unit', c->>'unit',
    'doc', case when b.t = 'doc' then c->'doc' end))
  from (select case when p_lang = 'ru' then b.ru else b.uz end as c) x
$$;
-- javobdan keyin: to'g'ri javob, izoh; hujjatda — xato qatorlar va har biriga tushuntirish; qonun savolida — manba
create or replace function public.liga_q_reveal(b public.liga_bank, p_lang text) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('dt', case when b.t <> 'doc' then b.dt end, 'kt', b.kt, 'a', b.a, 'e', c->>'e',
    'bad', case when b.t = 'doc' then to_jsonb(string_to_array(nullif(coalesce(b.dt, ''), ''), ',')) end,
    'none', case when b.t = 'doc' and coalesce(b.dt, '') = '' then true end,
    'fix', case when b.t = 'doc' then c->'fix' end, 'src', c->>'src'))
  from (select case when p_lang = 'ru' then b.ru else b.uz end as c) x
$$;
-- hujjat — 150 soniya (o'qish kerak), qonun savoli — 90 soniya
create or replace function public.liga_run_qsec(p_kind text) returns integer
language sql immutable as $$
  select case when p_kind = 'stage' then 120 when p_kind = 'doc' then 150 when p_kind = 'law' then 90 else 60 end
$$;
-- xodim testida ham ilovadan chiqishlar yoziladi (rahbar hisobotida ko'rinadi)
create or replace function public.liga_run_away(p_run uuid, p_id uuid, p_token text, p_secret text, p_k integer, p_ms integer) returns void
language plpgsql security definer set search_path = public as $$
declare r public.liga_runs;
begin
  r := public.liga_run_auth(p_run, p_id, p_token, p_secret);
  if (select count(*) from public.liga_away where ref = p_run::text) >= 300 then return; end if;
  insert into public.liga_away(player_id, kind, ref, k, ms) values (r.player_id, r.kind, p_run::text, p_k, least(greatest(coalesce(p_ms, 0), 0), 3600000));
end $$;

-- ================= 1) Faktura detektivi =================
create or replace function public.liga_doc_cfg(p_key text, p_def text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.liga_bot_config where key = p_key), p_def)
$$;
-- kunlik 5 ta hujjat: 1 ta oson, 2 ta o'rta, 2 ta qiyin; avval o'yinchi ko'rmaganlari
create or replace function public.liga_doc_draw(p_player uuid) returns text[]
language sql volatile security definer set search_path = public as $$
  with seen as (select a.qid from public.liga_run_ans a join public.liga_runs r on r.id = a.run_id where r.kind = 'doc' and r.player_id = p_player),
  b as (select x.id, coalesce((x.uz->>'lv')::int, 2) lv, x.id in (select qid from seen) old, random() rnd
          from public.liga_bank x where x.pool = 'doc' and x.t = 'doc' and x.active),
  z as (select id, lv, rnd, row_number() over (partition by lv order by old, rnd) rn from b)
  select array_agg(id order by lv, rnd) from z where (lv = 1 and rn <= 1) or (lv = 2 and rn <= 2) or (lv = 3 and rn <= 2)
$$;
create or replace function public.liga_doc_start(p_id uuid, p_token text, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid; fin timestamptz; q text[]; d text := public.liga_today()::text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if public.liga_doc_cfg('doc_on', 'on') <> 'on' then raise exception 'doc_off'; end if;
  select id, finished_at into rid, fin from public.liga_runs where kind = 'doc' and player_id = p_id and ref = d;
  if rid is null then
    q := public.liga_doc_draw(p_id);
    if coalesce(array_length(q, 1), 0) = 0 then raise exception 'not_found'; end if;
    begin rid := public.liga_run_new('doc', p_id, d, null, p_lang, q);
    exception when unique_violation then select id into rid from public.liga_runs where kind = 'doc' and player_id = p_id and ref = d; end;
  else
    if fin is not null then raise exception 'already_done'; end if;
    update public.liga_runs set lang = case when p_lang = 'ru' then 'ru' else 'uz' end where id = rid;
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;
-- o'yinchining detektiv natijalari: bugun, shu hafta, jami (faqat o'ziga)
create or replace function public.liga_doc_me(p_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t jsonb;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select jsonb_build_object('n', array_length(r.qids, 1), 'done_n', r.done_n, 'right_n', r.right_n, 'finished', r.finished_at is not null) into t
    from public.liga_runs r where r.kind = 'doc' and r.player_id = p_id and r.ref = public.liga_today()::text;
  return jsonb_build_object('on', public.liga_doc_cfg('doc_on', 'on') = 'on', 'today', t,
    'week_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id and started_at >= public.liga_week_start()),
    'week_days', (select count(*) from public.liga_runs where kind = 'doc' and player_id = p_id and started_at >= public.liga_week_start()),
    'total_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id),
    'total_n', (select coalesce(sum(done_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id),
    'days', (select count(*) from public.liga_runs where kind = 'doc' and player_id = p_id));
end $$;

-- ================= 2) Qonun yangiligi testi =================
alter table public.liga_news add column if not exists day date;                       -- qaysi kundan ko'rinadi (bo'sh — darhol)
alter table public.liga_news add column if not exists status text not null default 'live';   -- draft | live | off
alter table public.liga_news add column if not exists source text not null default 'admin';  -- admin | ai | task
alter table public.liga_news add column if not exists decided_by bigint;
alter table public.liga_news add column if not exists decided_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'liga_news_status_check') then
    alter table public.liga_news add constraint liga_news_status_check check (status in ('draft', 'live', 'off'));
  end if;
end $$;

-- yangilikning savollarini bankka ko'chiradi (id: law<N>_<k>); javoblar faqat bankda, ilovaga bormaydi
create or replace function public.liga_news_sync(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n public.liga_news; k int := 0; x jsonb; on_ boolean;
begin
  select * into n from public.liga_news where id = p_id;
  if n.id is null then return 0; end if;
  on_ := n.active and n.status = 'live';
  for x in select value from jsonb_array_elements(coalesce(n.qs, '[]'::jsonb)) loop
    insert into public.liga_bank(id, pool, t, uz, ru, a, active)
    values ('law' || n.id || '_' || k, 'law', 'mc',
      jsonb_build_object('q', x->>'q', 'o', x->'o', 'e', coalesce(x->>'e', ''), 'src', n.url),
      jsonb_build_object('q', coalesce(nullif(x->>'q_ru', ''), x->>'q'), 'o', coalesce(case when jsonb_typeof(x->'o_ru') = 'array' and jsonb_array_length(x->'o_ru') = jsonb_array_length(x->'o') then x->'o_ru' end, x->'o'),
        'e', coalesce(nullif(x->>'e_ru', ''), x->>'e', ''), 'src', n.url),
      (x->>'a')::numeric, on_)
    on conflict (id) do update set pool = 'law', t = 'mc', uz = excluded.uz, ru = excluded.ru, a = excluded.a, active = excluded.active;
    k := k + 1;
  end loop;
  -- savollar kamaygan bo'lsa — ortiqchalari o'chiriladi (eski javoblar jurnalda qoladi)
  update public.liga_bank set active = false where pool = 'law' and id like 'law' || n.id || '\_%' and substr(id, length('law' || n.id || '_') + 1)::int >= k;
  return k;
end $$;
create or replace function public.liga_news_valid(qs jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(qs) = 'array' and not exists (select 1 from jsonb_array_elements(qs) x where jsonb_typeof(x->'o') <> 'array'
      or jsonb_array_length(x->'o') not between 2 and 5 or coalesce(x->>'a', '') !~ '^\d+$' or (x->>'a')::int >= jsonb_array_length(x->'o') or length(coalesce(x->>'q','')) < 5)
$$;
create or replace function public.liga_news_save(p_pin text, p_id bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; qs jsonb := coalesce(p->'qs', '[]'::jsonb); dd date := nullif(p->>'day', '')::date; st text := coalesce(nullif(p->>'status', ''), 'live');
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then raise exception 'not_admin'; end if;
  if length(trim(coalesce(p->>'title_uz',''))) < 5 or length(trim(coalesce(p->>'body_uz',''))) < 10 or not public.liga_news_valid(qs) or st not in ('draft', 'live', 'off') then raise exception 'bad_input'; end if;
  if p_id is null then
    insert into public.liga_news(title_uz, title_ru, body_uz, body_ru, url, qs, day, status, active, source)
    values (left(trim(p->>'title_uz'),200), left(p->>'title_ru',200), left(trim(p->>'body_uz'),3000), left(p->>'body_ru',3000), left(p->>'url',500), qs, dd, st, st = 'live', 'admin')
    returning id into nid;
  else
    update public.liga_news set title_uz = left(trim(p->>'title_uz'),200), title_ru = left(p->>'title_ru',200), body_uz = left(trim(p->>'body_uz'),3000),
      body_ru = left(p->>'body_ru',3000), url = left(p->>'url',500), qs = qs, day = dd, status = st,
      active = coalesce((p->>'active')::boolean, true) and st = 'live' where id = p_id returning id into nid;
  end if;
  perform public.liga_news_sync(nid);
  return nid;
end $$;
-- ilovaga: faqat chiqarilgan va kuni kelgan yangiliklar; savollar javobsiz (q, o — ikki tilda)
drop function if exists public.liga_news_list();
create or replace function public.liga_news_list()
returns table(id bigint, created_at timestamptz, title_uz text, title_ru text, body_uz text, body_ru text, url text, qs jsonb, day date)
language sql stable security definer set search_path = public as $$
  select n.id, coalesce(n.day::timestamptz, n.created_at), n.title_uz, n.title_ru, n.body_uz, n.body_ru, n.url,
    coalesce((select jsonb_agg(jsonb_build_object('q', x->>'q', 'o', x->'o', 'q_ru', x->>'q_ru', 'o_ru', x->'o_ru') order by o) from jsonb_array_elements(n.qs) with ordinality e(x, o)), '[]'::jsonb),
    n.day
  from public.liga_news n
  where n.active and n.status = 'live' and (n.day is null or n.day <= public.liga_today())
  order by coalesce(n.day::timestamptz, n.created_at) desc, n.id desc limit 30
$$;
create or replace function public.liga_law_start(p_id uuid, p_token text, p_news bigint, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare n public.liga_news; rid uuid; fin timestamptz; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  select * into n from public.liga_news where id = p_news;
  if n.id is null or not n.active or n.status <> 'live' or coalesce(n.day, public.liga_today()) > public.liga_today() then raise exception 'not_found'; end if;
  select id, finished_at into rid, fin from public.liga_runs where kind = 'law' and player_id = p_id and ref = n.id::text;
  if rid is null then
    select array_agg(id order by substr(id, length('law' || n.id || '_') + 1)::int) into q
      from public.liga_bank where pool = 'law' and active and id like 'law' || n.id || '\_%';
    if coalesce(array_length(q, 1), 0) = 0 then raise exception 'not_found'; end if;
    begin rid := public.liga_run_new('law', p_id, n.id::text, null, p_lang, q);
    exception when unique_violation then select id into rid from public.liga_runs where kind = 'law' and player_id = p_id and ref = n.id::text; end;
  else
    if fin is not null then raise exception 'already_done'; end if;
    update public.liga_runs set lang = case when p_lang = 'ru' then 'ru' else 'uz' end where id = rid;
  end if;
  perform public.liga_run_sweep(rid);
  return public.liga_run_view(rid);
end $$;
-- o'yinchining qonun testlari natijasi (kartochkalarda «3/3» ko'rinadi)
create or replace function public.liga_law_me(p_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return jsonb_build_object(
    'runs', coalesce((select jsonb_object_agg(r.ref, jsonb_build_object('n', array_length(r.qids, 1), 'right_n', r.right_n, 'done_n', r.done_n, 'finished', r.finished_at is not null))
                      from public.liga_runs r where r.kind = 'law' and r.player_id = p_id and r.started_at > now() - interval '60 days'), '{}'::jsonb),
    'month_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'law' and player_id = p_id
                      and (started_at at time zone 'Asia/Tashkent')::date >= date_trunc('month', public.liga_today())::date));
end $$;
-- qoralama: rejalashtirilgan vazifa yoki AI yozadi; admin botda tasdiqlaydi
create or replace function public.liga_law_draft_sys(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; qs jsonb := coalesce(p->'qs', '[]'::jsonb);
begin
  if length(trim(coalesce(p->>'title_uz',''))) < 5 or length(trim(coalesce(p->>'body_uz',''))) < 10 or not public.liga_news_valid(qs) or jsonb_array_length(qs) = 0 then
    raise exception 'bad_input'; end if;
  insert into public.liga_news(title_uz, title_ru, body_uz, body_ru, url, qs, day, status, active, source)
  values (left(trim(p->>'title_uz'),200), left(p->>'title_ru',200), left(trim(p->>'body_uz'),3000), left(p->>'body_ru',3000), left(p->>'url',500), qs,
          nullif(p->>'day', '')::date, 'draft', false, coalesce(nullif(p->>'source', ''), 'task'))
  returning id into nid;
  perform public.liga_news_sync(nid);
  perform public.liga_bot_call2('law_draft', jsonb_build_object('id', nid));
  return nid;
end $$;
create or replace function public.liga_law_decide_sys(p_id bigint, p_ok boolean, p_admin_chat bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n public.liga_news;
begin
  if not exists (select 1 from public.liga_admin_chats where chat_id = p_admin_chat) then return jsonb_build_object('done', false, 'reason', 'not_admin'); end if;
  select * into n from public.liga_news where id = p_id for update;
  if n.id is null then return jsonb_build_object('done', false, 'reason', 'not_found'); end if;
  if n.status <> 'draft' then return jsonb_build_object('done', false, 'reason', 'already', 'status', n.status); end if;
  update public.liga_news set status = case when p_ok then 'live' else 'off' end, active = p_ok, decided_by = p_admin_chat, decided_at = now(),
    day = case when p_ok then greatest(coalesce(day, public.liga_today()), public.liga_today()) else day end
   where id = p_id returning * into n;
  perform public.liga_news_sync(p_id);
  return jsonb_build_object('done', true, 'status', n.status, 'day', n.day, 'today', n.day <= public.liga_today());
end $$;
-- botga: yangilik (admin ko'rishi uchun to'liq, javoblar bilan)
create or replace function public.liga_law_get_sys(p_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(n) from public.liga_news n where n.id = p_id
$$;
-- botga: bugun guruhlarga chiqishi kerak bo'lgan (kuni kelgan, hali yuborilmagan) yangilik
create or replace function public.liga_law_due_sys() returns setof public.liga_news
language sql stable security definer set search_path = public as $$
  select * from public.liga_news where active and status = 'live' and posted_at is null and coalesce(day, public.liga_today()) <= public.liga_today()
    and coalesce(day::timestamptz, created_at) > now() - interval '14 days' order by coalesce(day::timestamptz, created_at), id limit 1
$$;

-- ================= 3) Rahbar uchun buxgalter tekshiruvi =================
alter table public.liga_tests add column if not exists owner_tg bigint;
alter table public.liga_tests add column if not exists owner_name text;
alter table public.liga_tests add column if not exists company text;
alter table public.liga_test_runs add column if not exists notified_at timestamptz;
create index if not exists liga_tests_owner on public.liga_tests (owner_tg) where owner_tg is not null;
create table if not exists public.liga_chk_quota (tg bigint primary key, extra int not null default 0, updated_at timestamptz not null default now());
create table if not exists public.liga_chk_wiz (chat_id bigint primary key, step text not null, lang text, updated_at timestamptz not null default now());
alter table public.liga_chk_quota enable row level security;
alter table public.liga_chk_wiz enable row level security;
revoke all on public.liga_chk_quota, public.liga_chk_wiz from anon, authenticated;

create or replace function public.liga_chk_limit(p_tg bigint) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(public.liga_doc_cfg('chk_free', '3'), '')::int, 3) + coalesce((select extra from public.liga_chk_quota where tg = p_tg), 0)
$$;
create or replace function public.liga_chk_create_sys(p_tg bigint, p_name text, p_company text, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; used int; lim int := public.liga_chk_limit(p_tg); co text := left(trim(coalesce(p_company, '')), 80);
begin
  if p_tg is null or length(co) < 2 then raise exception 'bad_input'; end if;
  perform pg_advisory_xact_lock(hashtext('chk|' || p_tg));
  select count(*) into used from public.liga_tests where owner_tg = p_tg;
  if used >= lim then return jsonb_build_object('err', 'limit', 'used', used, 'limit', lim); end if;
  loop c := public.liga_short_code(7); exit when not exists (select 1 from public.liga_tests where code = c); end loop;
  insert into public.liga_tests(code, group_code, title, n, minutes, lang, owner_tg, owner_name, company)
  values (c, 'ASOSIY', case when p_lang = 'ru' then 'Тест на должность бухгалтера' else 'Buxgalter lavozimiga test' end, 30, 30,
          case when p_lang = 'ru' then 'ru' else 'uz' end, p_tg, left(coalesce(p_name, ''), 80), co);
  return jsonb_build_object('code', c, 'used', used + 1, 'limit', lim);
end $$;
create or replace function public.liga_chk_list_sys(p_tg bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('limit', public.liga_chk_limit(p_tg), 'used', (select count(*) from public.liga_tests where owner_tg = p_tg),
    'tests', coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'company', t.company, 'created_at', t.created_at, 'active', t.active,
      'runs', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.cand_name, 'phone', r.cand_phone, 'score', r.score, 'total', r.total,
                  'finished', r.finished_at is not null) order by r.started_at) from public.liga_test_runs r where r.code = t.code), '[]'::jsonb))
      order by t.created_at desc), '[]'::jsonb))
  from (select * from public.liga_tests where owner_tg = p_tg order by created_at desc limit 20) t
$$;
-- nomzod hisobot: umumiy natija, tur bo'yicha (provodka / hisob / test), mavzu bo'yicha, ilovadan chiqishlar
create or replace function public.liga_chk_report_sys(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tr public.liga_test_runs; t public.liga_tests; rid uuid; by_t jsonb; by_pool jsonb; left_n int; time_n int; away_n int;
begin
  select * into tr from public.liga_test_runs where id = p_run;
  if tr.id is null then return null; end if;
  select * into t from public.liga_tests where code = tr.code;
  select id into rid from public.liga_runs where kind = 'test' and ref = tr.id::text;
  select jsonb_object_agg(tt, jsonb_build_array(r, n)) into by_t from (
    select b.t tt, count(*) filter (where a.ok) r, count(*) n from public.liga_run_ans a join public.liga_bank b on b.id = a.qid where a.run_id = rid group by b.t) z;
  select jsonb_agg(jsonb_build_array(pool, r, n) order by pool) into by_pool from (
    select b.pool, count(*) filter (where a.ok) r, count(*) n from public.liga_run_ans a join public.liga_bank b on b.id = a.qid where a.run_id = rid group by b.pool) z;
  select count(*) filter (where why = 'left'), count(*) filter (where why = 'time') into left_n, time_n from public.liga_run_ans where run_id = rid;
  select count(*) into away_n from public.liga_away where ref = rid::text and ms >= 1500;
  return jsonb_build_object('code', t.code, 'company', t.company, 'owner_tg', t.owner_tg, 'lang', t.lang, 'name', tr.cand_name, 'phone', tr.cand_phone,
    'score', tr.score, 'total', tr.total, 'ms', tr.ms, 'late', tr.late, 'minutes', t.minutes, 'finished', tr.finished_at is not null,
    'by_t', coalesce(by_t, '{}'::jsonb), 'by_pool', coalesce(by_pool, '[]'::jsonb), 'left_n', left_n, 'time_n', time_n, 'away_n', away_n, 'notified_at', tr.notified_at);
end $$;
create or replace function public.liga_chk_mark_sys(p_run uuid) returns boolean
language sql security definer set search_path = public as $$
  update public.liga_test_runs set notified_at = now() where id = p_run and notified_at is null returning true
$$;
create or replace function public.liga_chk_grant_sys(p_admin_chat bigint, p_tg bigint, p_n int) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.liga_admin_chats where chat_id = p_admin_chat) then raise exception 'not_admin'; end if;
  insert into public.liga_chk_quota(tg, extra) values (p_tg, greatest(0, p_n)) on conflict (tg) do update set extra = public.liga_chk_quota.extra + greatest(0, p_n), updated_at = now();
  return public.liga_chk_limit(p_tg);
end $$;
-- nomzod testni tugatdi → rahbarga bot orqali hisobot
create or replace function public.liga_chk_done_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.finished_at is not null and old.finished_at is null and new.notified_at is null
     and exists (select 1 from public.liga_tests where code = new.code and owner_tg is not null) then
    perform public.liga_bot_call2('chk_done', jsonb_build_object('run', new.id));
  end if;
  return new;
end $$;
drop trigger if exists liga_chk_done on public.liga_test_runs;
create trigger liga_chk_done after update of finished_at on public.liga_test_runs for each row execute function public.liga_chk_done_trg();

-- ================= huquqlar =================
revoke all on function public.liga_doc_keys(jsonb), public.liga_doc_cfg(text, text), public.liga_doc_draw(uuid), public.liga_news_sync(bigint),
  public.liga_news_valid(jsonb), public.liga_law_draft_sys(jsonb), public.liga_law_decide_sys(bigint, boolean, bigint), public.liga_law_get_sys(bigint),
  public.liga_law_due_sys(), public.liga_chk_limit(bigint), public.liga_chk_create_sys(bigint, text, text, text), public.liga_chk_list_sys(bigint),
  public.liga_chk_report_sys(uuid), public.liga_chk_mark_sys(uuid), public.liga_chk_grant_sys(bigint, bigint, int), public.liga_chk_done_trg()
  from public, anon, authenticated;
grant execute on function public.liga_law_draft_sys(jsonb), public.liga_law_decide_sys(bigint, boolean, bigint), public.liga_law_get_sys(bigint),
  public.liga_law_due_sys(), public.liga_chk_create_sys(bigint, text, text, text), public.liga_chk_list_sys(bigint), public.liga_chk_report_sys(uuid),
  public.liga_chk_mark_sys(uuid), public.liga_chk_grant_sys(bigint, bigint, int), public.liga_news_sync(bigint) to service_role;
revoke all on function public.liga_doc_start(uuid, text, text), public.liga_doc_me(uuid, text), public.liga_law_start(uuid, text, bigint, text), public.liga_law_me(uuid, text) from public;
grant execute on function public.liga_doc_start(uuid, text, text), public.liga_doc_me(uuid, text), public.liga_law_start(uuid, text, bigint, text), public.liga_law_me(uuid, text),
  public.liga_news_list() to anon, authenticated;
