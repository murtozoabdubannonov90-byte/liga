-- 2026-11-03: yangi bo'limlar (Faktura detektivi, qonun yangiligi testi, /tekshiruv) avval faqat liga egasiga.
-- liga_bot_config.new3_beta = 'on' — faqat egasi (free_phones) ko'radi va o'ynaydi; boshqalarga karta, plitka, test chiqmaydi,
-- qonun yangiligi guruhlarga yuborilmaydi, /tekshiruv faqat liga adminiga ishlaydi.
-- Hammaga ochish:  update liga_bot_config set value = 'off' where key = 'new3_beta';
insert into public.liga_bot_config(key, value) values ('new3_beta', 'on') on conflict (key) do nothing;

create or replace function public.liga_is_owner(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.safari_players s where s.id = p_id
    and s.phone = any(string_to_array(coalesce((select value from public.liga_bot_config where key = 'free_phones'), ''), ',')))
$$;
create or replace function public.liga_new3_open(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.liga_bot_config where key = 'new3_beta'), 'off') <> 'on' or public.liga_is_owner(p_id)
$$;

create or replace function public.liga_doc_start(p_id uuid, p_token text, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid uuid; fin timestamptz; q text[]; d text := public.liga_today()::text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if public.liga_doc_cfg('doc_on', 'on') <> 'on' or not public.liga_new3_open(p_id) then raise exception 'doc_off'; end if;
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
  return jsonb_build_object('on', public.liga_doc_cfg('doc_on', 'on') = 'on' and public.liga_new3_open(p_id), 'today', t,
    'owner', public.liga_is_owner(p_id), 'beta', coalesce(public.liga_doc_cfg('new3_beta', 'off'), 'off') = 'on',
    'week_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id and started_at >= public.liga_week_start()),
    'week_days', (select count(*) from public.liga_runs where kind = 'doc' and player_id = p_id and started_at >= public.liga_week_start()),
    'total_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id),
    'total_n', (select coalesce(sum(done_n), 0) from public.liga_runs where kind = 'doc' and player_id = p_id),
    'days', (select count(*) from public.liga_runs where kind = 'doc' and player_id = p_id));
end $$;

create or replace function public.liga_law_start(p_id uuid, p_token text, p_news bigint, p_lang text default 'uz') returns jsonb
language plpgsql security definer set search_path = public as $$
declare n public.liga_news; rid uuid; fin timestamptz; q text[];
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if not public.liga_player_ok(p_id) then raise exception 'unpaid'; end if;
  if not public.liga_new3_open(p_id) then raise exception 'not_found'; end if;
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

create or replace function public.liga_law_me(p_id uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return jsonb_build_object('on', public.liga_new3_open(p_id),
    'runs', coalesce((select jsonb_object_agg(r.ref, jsonb_build_object('n', array_length(r.qids, 1), 'right_n', r.right_n, 'done_n', r.done_n, 'finished', r.finished_at is not null))
                      from public.liga_runs r where r.kind = 'law' and r.player_id = p_id and r.started_at > now() - interval '60 days'), '{}'::jsonb),
    'month_right', (select coalesce(sum(right_n), 0) from public.liga_runs where kind = 'law' and player_id = p_id
                      and (started_at at time zone 'Asia/Tashkent')::date >= date_trunc('month', public.liga_today())::date));
end $$;

-- sinov davrida qonun yangiligi guruhlarga va ertalabki shaxsiy xabarlarga chiqmaydi
create or replace function public.liga_law_due_sys() returns setof public.liga_news
language sql stable security definer set search_path = public as $$
  select * from public.liga_news where coalesce((select value from public.liga_bot_config where key = 'new3_beta'), 'off') <> 'on'
    and active and status = 'live' and posted_at is null and coalesce(day, public.liga_today()) <= public.liga_today()
    and coalesce(day::timestamptz, created_at) > now() - interval '14 days' order by coalesce(day::timestamptz, created_at), id limit 1
$$;

revoke all on function public.liga_is_owner(uuid), public.liga_new3_open(uuid) from public, anon, authenticated;
revoke all on function public.liga_doc_start(uuid, text, text), public.liga_doc_me(uuid, text), public.liga_law_start(uuid, text, bigint, text), public.liga_law_me(uuid, text) from public;
grant execute on function public.liga_doc_start(uuid, text, text), public.liga_doc_me(uuid, text), public.liga_law_start(uuid, text, bigint, text), public.liga_law_me(uuid, text) to anon, authenticated;
