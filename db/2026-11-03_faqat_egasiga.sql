-- 2026-11-03: sinov davri — Faktura detektivi, qonun yangiligi testi va rahbar tekshiruvi dastlab faqat liga egasiga (free_phones).
-- Yoqish (hammaga ochish): update liga_bot_config set value = 'off' where key = 'beta_only';
insert into public.liga_bot_config(key, value) values ('beta_only', 'on') on conflict (key) do nothing;

create or replace function public.liga_is_owner(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.safari_players s where s.id = p_id
    and s.phone = any(string_to_array(coalesce((select value from public.liga_bot_config where key = 'free_phones'), ''), ',')))
$$;
create or replace function public.liga_beta_ok(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.liga_doc_cfg('beta_only', 'on') <> 'on' or public.liga_is_owner(p_id)
$$;

-- yangilik holati: beta — faqat egasiga ko'rinadi
alter table public.liga_news drop constraint if exists liga_news_status_check;
alter table public.liga_news add constraint liga_news_status_check check (status in ('draft', 'beta', 'live', 'off'));

create or replace function public.liga_news_sync(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n public.liga_news; k int := 0; x jsonb; on_ boolean;
begin
  select * into n from public.liga_news where id = p_id;
  if n.id is null then return 0; end if;
  on_ := n.active and n.status in ('live', 'beta');
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
  update public.liga_bank set active = false where pool = 'law' and id like 'law' || n.id || '\_%' and substr(id, length('law' || n.id || '_') + 1)::int >= k;
  return k;
end $$;

-- admin «Chiqarish» bossa: sinov davrida — beta (faqat egasiga), keyin — live (hammaga)
create or replace function public.liga_law_decide_sys(p_id bigint, p_ok boolean, p_admin_chat bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n public.liga_news; st text := case when public.liga_doc_cfg('beta_only', 'on') = 'on' then 'beta' else 'live' end;
begin
  if not exists (select 1 from public.liga_admin_chats where chat_id = p_admin_chat) then return jsonb_build_object('done', false, 'reason', 'not_admin'); end if;
  select * into n from public.liga_news where id = p_id for update;
  if n.id is null then return jsonb_build_object('done', false, 'reason', 'not_found'); end if;
  if n.status <> 'draft' then return jsonb_build_object('done', false, 'reason', 'already', 'status', n.status); end if;
  update public.liga_news set status = case when p_ok then st else 'off' end, active = p_ok, decided_by = p_admin_chat, decided_at = now(),
    day = case when p_ok then greatest(coalesce(day, public.liga_today()), public.liga_today()) else day end
   where id = p_id returning * into n;
  perform public.liga_news_sync(p_id);
  return jsonb_build_object('done', true, 'status', n.status, 'day', n.day, 'today', n.day <= public.liga_today());
end $$;

-- egasiga: sinovdagi (beta) yangiliklar, kunidan qat'i nazar (oldindan ko'rib chiqish uchun)
create or replace function public.liga_law_beta(p_id uuid, p_token text)
returns table(id bigint, created_at timestamptz, title_uz text, title_ru text, body_uz text, body_ru text, url text, qs jsonb, day date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) or not public.liga_is_owner(p_id) then return; end if;
  return query select n.id, coalesce(n.day::timestamptz, n.created_at), n.title_uz, n.title_ru, n.body_uz, n.body_ru, n.url,
    coalesce((select jsonb_agg(jsonb_build_object('q', x->>'q', 'o', x->'o', 'q_ru', x->>'q_ru', 'o_ru', x->'o_ru') order by o) from jsonb_array_elements(n.qs) with ordinality e(x, o)), '[]'::jsonb), n.day
  from public.liga_news n where n.active and n.status = 'beta' order by coalesce(n.day::timestamptz, n.created_at) desc, n.id desc limit 30;
end $$;

create or replace function public.liga_law_start(p_id uuid, p_token text, p_news bigint, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare n public.liga_news; rid uuid; fin timestamptz; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  select * into n from public.liga_news where id = p_news;
  if n.id is null or not n.active then raise exception 'not_found'; end if;
  if n.status = 'beta' then
    if not public.liga_is_owner(p_id) then raise exception 'not_found'; end if;
  elsif n.status <> 'live' or coalesce(n.day, public.liga_today()) > public.liga_today() then raise exception 'not_found'; end if;
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

-- detektiv: sinov davrida faqat egasiga
create or replace function public.liga_doc_start(p_id uuid, p_token text, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid; fin timestamptz; q text[]; d text := public.liga_today()::text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if public.liga_doc_cfg('doc_on', 'on') <> 'on' or not public.liga_beta_ok(p_id) then raise exception 'doc_off'; end if;
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
create or replace function public.liga_doc_me(p_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t jsonb;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select jsonb_build_object('n', array_length(r.qids, 1), 'done_n', r.done_n, 'right_n', r.right_n, 'finished', r.finished_at is not null) into t
    from public.liga_runs r where r.kind = 'doc' and r.player_id = p_id and r.ref = public.liga_today()::text;
  return jsonb_build_object('on', public.liga_doc_cfg('doc_on', 'on') = 'on' and public.liga_beta_ok(p_id), 'today', t,
    'owner', public.liga_is_owner(p_id), 'beta', public.liga_doc_cfg('beta_only', 'on') = 'on',
    'week_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id and started_at >= public.liga_week_start()),
    'week_days', (select count(*) from public.liga_runs where kind = 'doc' and player_id = p_id and started_at >= public.liga_week_start()),
    'total_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id),
    'total_n', (select coalesce(sum(done_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id),
    'days', (select count(*) from public.liga_runs where kind = 'doc' and player_id = p_id));
end $$;

-- rahbar tekshiruvi: sinov davrida faqat liga adminlari yarata oladi
create or replace function public.liga_chk_create_sys(p_tg bigint, p_name text, p_company text, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; used int; lim int := public.liga_chk_limit(p_tg); co text := left(trim(coalesce(p_company, '')), 80);
begin
  if p_tg is null or length(co) < 2 then raise exception 'bad_input'; end if;
  if public.liga_doc_cfg('beta_only', 'on') = 'on' and not exists (select 1 from public.liga_admin_chats where chat_id = p_tg) then
    return jsonb_build_object('err', 'beta'); end if;
  perform pg_advisory_xact_lock(hashtext('chk|' || p_tg));
  select count(*) into used from public.liga_tests where owner_tg = p_tg;
  if used >= lim then return jsonb_build_object('err', 'limit', 'used', used, 'limit', lim); end if;
  loop c := public.liga_short_code(7); exit when not exists (select 1 from public.liga_tests where code = c); end loop;
  insert into public.liga_tests(code, group_code, title, n, minutes, lang, owner_tg, owner_name, company)
  values (c, 'ASOSIY', case when p_lang = 'ru' then 'Тест на должность бухгалтера' else 'Buxgalter lavozimiga test' end, 30, 30,
          case when p_lang = 'ru' then 'ru' else 'uz' end, p_tg, left(coalesce(p_name, ''), 80), co);
  return jsonb_build_object('code', c, 'used', used + 1, 'limit', lim);
end $$;
create or replace function public.liga_beta_sys(p_tg bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.liga_doc_cfg('beta_only', 'on') <> 'on' or exists (select 1 from public.liga_admin_chats where chat_id = p_tg)
$$;

revoke all on function public.liga_is_owner(uuid), public.liga_beta_ok(uuid), public.liga_beta_sys(bigint) from public, anon, authenticated;
grant execute on function public.liga_beta_sys(bigint) to service_role;
revoke all on function public.liga_law_beta(uuid, text) from public;
grant execute on function public.liga_law_beta(uuid, text) to anon, authenticated;
