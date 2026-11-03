-- Faktura detektivi, qonun testi va rahbar tekshiruvi — server sinovi.
-- Migratsiya va hujjatlar banki yuklangandan keyin ishga tushiriladi; oxirida ataylab xato chiqarib,
-- hamma o'zgarishni bekor qiladi (bazada iz qolmaydi). Natija xato xabarida: "DQT_TEST {...}" — hammasi true bo'lishi kerak.
do $t$
declare pid uuid := gen_random_uuid(); tok text := 'dqt-' || md5(random()::text); v jsonb; v2 jsonb; r jsonb := '{}'; b public.liga_bank; rid uuid;
  nid bigint; did bigint; adm bigint; x jsonb; c text; trid uuid; sec text; j int; n int; ok_n int := 0; items jsonb; bad_cnt int;
begin
  insert into public.safari_players(id, first_name, last_name, phone, token_hash, paid_until, lang)
    values (pid, 'Sinov', 'DQT', '+998900009911', public.liga_hash(tok), public.liga_today() + 5, 'uz');
  -- 1–3 bo'limlar hammaga ochiq holatda tekshiriladi (sinov davri 4-bo'limda)
  insert into public.liga_bot_config(key, value) values ('beta_only', 'off') on conflict (key) do update set value = 'off';

  -- ===== 0) sinov davri (new3_beta): oddiy o'yinchiga yopiq =====
  insert into public.liga_bot_config(key, value) values ('new3_beta', 'on') on conflict (key) do update set value = 'on';
  begin perform public.liga_doc_start(pid, tok, 'uz'); r := r || '{"beta_doc_closed": false}';
  exception when others then r := r || jsonb_build_object('beta_doc_closed', sqlerrm = 'doc_off'); end;
  r := r || jsonb_build_object('beta_doc_me_off', not (public.liga_doc_me(pid, tok)->>'on')::boolean,
    'beta_law_me_off', not (public.liga_law_me(pid, tok)->>'on')::boolean,
    'beta_owner_open', coalesce((select public.liga_new3_open(s.id) from public.safari_players s
       where s.phone = any(string_to_array((select value from public.liga_bot_config where key = 'free_phones'), ',')) limit 1), true));
  update public.liga_bot_config set value = 'off' where key = 'new3_beta';

  -- ===== 1) Faktura detektivi =====
  r := r || jsonb_build_object('bank240', (select count(*) from public.liga_bank where pool = 'doc' and t = 'doc' and active) >= 240,
                               'bank_clean', (select count(*) from public.liga_bank where pool = 'doc' and coalesce(dt, '') = '') > 0);
  v := public.liga_doc_start(pid, tok, 'uz');
  rid := (v->>'run')::uuid; items := v->'items';
  r := r || jsonb_build_object('doc5', jsonb_array_length(items) = 5 and (v->>'qsec')::int = 150,
    'doc_has_doc', (select bool_and(jsonb_typeof(i->'doc'->'rows') = 'array') from jsonb_array_elements(items) i),
    'doc_no_key', (select bool_and(not (i ? 'dt') and not (i ? 'a') and not (i->'doc' ? 'fix')) from jsonb_array_elements(items) i),
    'doc_order', (select array_agg((bk.uz->>'lv')::int order by a.k) = array[1,2,2,3,3] from public.liga_run_ans a join public.liga_bank bk on bk.id = a.qid where a.run_id = rid));
  -- qayta kirish — o'sha o'yin
  v2 := public.liga_doc_start(pid, tok, 'ru');
  r := r || jsonb_build_object('doc_resume', v2->>'run' = rid::text);
  -- 0-hujjat: to'g'ri javob
  select bk.* into b from public.liga_run_ans a join public.liga_bank bk on bk.id = a.qid where a.run_id = rid and a.k = 0;
  perform public.liga_run_show(pid, tok, rid, 0, null);
  v := public.liga_run_answer(pid, tok, rid, 0, jsonb_build_object('pick', to_jsonb(string_to_array(nullif(coalesce(b.dt, ''), ''), ','))), null);
  r := r || jsonb_build_object('doc_right', (v->>'ok')::boolean, 'doc_reveal_fix', jsonb_typeof(v->'reveal'->'fix') = 'object' and v->'reveal'->'bad' is not null and not (v->'reveal' ? 'dt'));
  -- 1-hujjat: noto'g'ri (ortiqcha qator belgilangan)
  select bk.* into b from public.liga_run_ans a join public.liga_bank bk on bk.id = a.qid where a.run_id = rid and a.k = 1;
  v := public.liga_run_answer(pid, tok, rid, 1, jsonb_build_object('pick', to_jsonb(array_append(string_to_array(nullif(coalesce(b.dt, ''), ''), ','), 'zzz_extra'))), null);
  r := r || jsonb_build_object('doc_extra_wrong', not (v->>'ok')::boolean);
  -- 2-hujjat: «pick» yo'q — xato
  v := public.liga_run_answer(pid, tok, rid, 2, '{}'::jsonb, null);
  r := r || jsonb_build_object('doc_nopick_wrong', not (v->>'ok')::boolean);
  -- toza hujjat: bo'sh ro'yxat to'g'ri, biror qator belgilash xato
  select * into b from public.liga_bank where pool = 'doc' and coalesce(dt, '') = '' limit 1;
  r := r || jsonb_build_object('clean_empty_ok', public.liga_q_ok(b, '{"pick":[]}'), 'clean_mark_wrong', not public.liga_q_ok(b, '{"pick":["sum"]}'),
    'clean_reveal_none', (public.liga_q_reveal(b, 'uz')->>'none')::boolean);
  -- tartib ahamiyatsiz, takror ahamiyatsiz
  select * into b from public.liga_bank where pool = 'doc' and dt like '%,%' limit 1;
  r := r || jsonb_build_object('order_free', public.liga_q_ok(b, jsonb_build_object('pick', (select jsonb_agg(u.z order by u.z desc) from unnest(string_to_array(b.dt, ',') || string_to_array(b.dt, ',')) u(z)))));
  -- qolganlarini tugatish
  for j in 3..4 loop v := public.liga_run_answer(pid, tok, rid, j, '{"pick":[]}', null); end loop;
  r := r || jsonb_build_object('doc_finished', (v->>'finished')::boolean and (v->>'done_n')::int = 5);
  begin perform public.liga_doc_start(pid, tok, 'uz'); r := r || '{"doc_once": false}';
  exception when others then r := r || jsonb_build_object('doc_once', sqlerrm = 'already_done'); end;
  v := public.liga_doc_me(pid, tok);
  r := r || jsonb_build_object('doc_me', (v->'today'->>'finished')::boolean and (v->>'total_n')::int = 5 and (v->>'week_right')::int >= 1);
  -- doc o'yini liga baliga qo'shilmaydi
  r := r || jsonb_build_object('doc_no_gain', (select gain from public.liga_runs where id = rid) = 0);
  -- detektiv savollari bosqich/duel hovuzlariga kirmaydi
  r := r || jsonb_build_object('doc_not_in_pools', not ('doc' = any(public.liga_quad_pools())) and not ('law' = any(public.liga_quad_pools())));

  -- ===== 2) Qonun yangiligi testi =====
  insert into public.liga_news(title_uz, body_uz, url, qs, status, active, day)
  values ('Sinov yangiligi DQT', 'Sinov uchun qisqa matn, o''n belgidan uzun.', 'https://lex.uz/x',
    '[{"q":"Birinchi savol?","o":["A","B","C"],"a":1,"e":"Chunki B","q_ru":"Первый вопрос?","o_ru":["А","Б","В"]},{"q":"Ikkinchi savol?","o":["X","Y"],"a":0,"e":"X"},{"q":"Uchinchi savol?","o":["1","2","3","4"],"a":3,"e":"4"}]',
    'live', true, public.liga_today()) returning id into nid;
  perform public.liga_news_sync(nid);
  r := r || jsonb_build_object('law_bank3', (select count(*) from public.liga_bank where pool = 'law' and active and id like 'law' || nid || '\_%') = 3);
  select to_jsonb(l) into x from public.liga_news_list() l where l.id = nid;
  r := r || jsonb_build_object('law_list', x is not null and jsonb_array_length(x->'qs') = 3,
    'law_list_no_answer', not exists (select 1 from jsonb_array_elements(x->'qs') qq where qq ? 'a' or qq ? 'e'));
  v := public.liga_law_start(pid, tok, nid, 'ru'); rid := (v->>'run')::uuid;
  r := r || jsonb_build_object('law_run', jsonb_array_length(v->'items') = 3 and (v->>'qsec')::int = 90 and v->'items'->0->>'q' = 'Первый вопрос?');
  v := public.liga_run_answer(pid, tok, rid, 0, '{"pick":1}', null);
  r := r || jsonb_build_object('law_right', (v->>'ok')::boolean and v->'reveal'->>'src' = 'https://lex.uz/x');
  v := public.liga_run_answer(pid, tok, rid, 1, '{"pick":1}', null);
  r := r || jsonb_build_object('law_wrong', not (v->>'ok')::boolean and (v->'reveal'->>'a')::int = 0);
  v := public.liga_run_answer(pid, tok, rid, 2, '{"pick":3}', null);
  v := public.liga_law_me(pid, tok);
  r := r || jsonb_build_object('law_me', (v->'runs'->(nid::text)->>'right_n')::int = 2 and (v->'runs'->(nid::text)->>'finished')::boolean);
  begin perform public.liga_law_start(pid, tok, nid, 'uz'); r := r || '{"law_once": false}';
  exception when others then r := r || jsonb_build_object('law_once', sqlerrm = 'already_done'); end;
  -- kelgusi kun yangiligi hali ko'rinmaydi va boshlanmaydi
  update public.liga_news set day = public.liga_today() + 2 where id = nid;
  r := r || jsonb_build_object('law_future_hidden', not exists (select 1 from public.liga_news_list() l where l.id = nid));
  -- qoralama: ro'yxatda yo'q, admin tasdiqlaydi
  did := public.liga_law_draft_sys(jsonb_build_object('title_uz', 'Qoralama DQT sinovi', 'body_uz', 'Qoralama matni, sinov uchun.', 'url', 'https://lex.uz/y',
    'day', public.liga_today()::text, 'qs', '[{"q":"Qoralama savoli?","o":["A","B"],"a":0,"e":"A"}]'::jsonb));
  r := r || jsonb_build_object('draft_hidden', not exists (select 1 from public.liga_news_list() l where l.id = did),
    'draft_bank_off', not exists (select 1 from public.liga_bank where id = 'law' || did || '_0' and active));
  begin perform public.liga_law_start(pid, tok, did, 'uz'); r := r || '{"draft_no_start": false}';
  exception when others then r := r || jsonb_build_object('draft_no_start', sqlerrm = 'not_found'); end;
  v := public.liga_law_decide_sys(did, true, -1);
  r := r || jsonb_build_object('decide_not_admin', not (v->>'done')::boolean and v->>'reason' = 'not_admin');
  select chat_id into adm from public.liga_admin_chats limit 1;
  if adm is null then adm := -999000111; insert into public.liga_admin_chats(chat_id, group_code) values (adm, 'ASOSIY'); end if;
  v := public.liga_law_decide_sys(did, true, adm);
  r := r || jsonb_build_object('decide_ok', (v->>'done')::boolean and v->>'status' = 'live',
    'draft_live', exists (select 1 from public.liga_news_list() l where l.id = did) and exists (select 1 from public.liga_bank where id = 'law' || did || '_0' and active));
  v := public.liga_law_decide_sys(did, false, adm);
  r := r || jsonb_build_object('decide_once', v->>'reason' = 'already');
  r := r || jsonb_build_object('due', exists (select 1 from public.liga_law_due_sys()));
  update public.liga_bot_config set value = 'on' where key = 'new3_beta';
  r := r || jsonb_build_object('beta_no_group_post', not exists (select 1 from public.liga_law_due_sys()));
  update public.liga_bot_config set value = 'off' where key = 'new3_beta';
  begin perform public.liga_law_draft_sys('{"title_uz":"x","body_uz":"y"}'); r := r || '{"draft_validates": false}';
  exception when others then r := r || jsonb_build_object('draft_validates', sqlerrm = 'bad_input'); end;

  -- ===== 3) Rahbar tekshiruvi =====
  delete from public.liga_tests where owner_tg = 777000111;
  for j in 1..3 loop v := public.liga_chk_create_sys(777000111, 'Rahbar', 'Sinov MChJ', 'uz'); end loop;
  c := v->>'code';
  r := r || jsonb_build_object('chk_create', c ~ '^[A-Z0-9]{7}$' and (v->>'used')::int = 3);
  v := public.liga_chk_create_sys(777000111, 'Rahbar', 'Sinov MChJ', 'uz');
  r := r || jsonb_build_object('chk_limit', v->>'err' = 'limit' and (v->>'limit')::int = 3);
  perform public.liga_chk_grant_sys(adm, 777000111, 2);
  v := public.liga_chk_create_sys(777000111, 'Rahbar', 'Sinov MChJ', 'uz');
  r := r || jsonb_build_object('chk_grant', v ? 'code' and (v->>'limit')::int = 5);
  begin perform public.liga_chk_grant_sys(-1, 777000111, 2); r := r || '{"grant_admin_only": false}';
  exception when others then r := r || jsonb_build_object('grant_admin_only', sqlerrm = 'not_admin'); end;
  -- nomzod testni ishlaydi
  v := public.liga_test_begin(c, 'Nomzod Sinov', '+998900009922', 'uz');
  rid := (v->>'run')::uuid; sec := v->>'secret'; n := jsonb_array_length(v->'items');
  select id into trid from public.liga_test_runs where code = c;
  perform public.liga_run_away(rid, null, null, sec, 0, 4000);
  for j in 0..n - 1 loop
    select bk.* into b from public.liga_run_ans a join public.liga_bank bk on bk.id = a.qid where a.run_id = rid and a.k = j;
    x := case when j % 3 = 0 then '{"left":true}'::jsonb when b.t = 'pv' then jsonb_build_object('dt', b.dt, 'kt', b.kt) when b.t = 'mc' then jsonb_build_object('pick', b.a) else jsonb_build_object('val', b.a::text) end;
    v := public.liga_run_answer(null, null, rid, j, x, sec);
    if (v->>'ok')::boolean then ok_n := ok_n + 1; end if;
  end loop;
  v := public.liga_chk_report_sys(trid);
  r := r || jsonb_build_object('rep_done', (v->>'finished')::boolean and (v->>'score')::int = ok_n and (v->>'total')::int = n,
    'rep_by_t', (select sum((e.value->>1)::int) from jsonb_each(v->'by_t') e) = n and (select sum((e.value->>0)::int) from jsonb_each(v->'by_t') e) = ok_n,
    'rep_left', (v->>'left_n')::int = (n + 2) / 3, 'rep_away', (v->>'away_n')::int = 1, 'rep_owner', (v->>'owner_tg')::bigint = 777000111);
  r := r || jsonb_build_object('mark_once', public.liga_chk_mark_sys(trid) and public.liga_chk_mark_sys(trid) is null);
  v := public.liga_chk_list_sys(777000111);
  r := r || jsonb_build_object('chk_list', jsonb_array_length(v->'tests') = 4 and (v->>'used')::int = 4);

  -- ===== 4) sinov davri: faqat egasiga =====
  update public.liga_bot_config set value = 'on' where key = 'beta_only';
  update public.liga_bot_config set value = '+998900009933' where key = 'free_phones';
  v := public.liga_doc_me(pid, tok);
  r := r || jsonb_build_object('beta_doc_hidden', not (v->>'on')::boolean and not (v->>'owner')::boolean);
  delete from public.liga_runs where kind = 'doc' and player_id = pid;
  begin perform public.liga_doc_start(pid, tok, 'uz'); r := r || '{"beta_doc_blocked": false}';
  exception when others then r := r || jsonb_build_object('beta_doc_blocked', sqlerrm = 'doc_off'); end;
  update public.safari_players set phone = '+998900009933' where id = pid;
  v := public.liga_doc_me(pid, tok);
  r := r || jsonb_build_object('beta_owner_doc', (v->>'on')::boolean and (v->>'owner')::boolean);
  did := public.liga_law_draft_sys(jsonb_build_object('title_uz', 'Beta DQT sinovi', 'body_uz', 'Beta matni, sinov uchun yozildi.', 'day', (public.liga_today() + 3)::text,
    'qs', '[{"q":"Beta savoli?","o":["A","B"],"a":0,"e":"A"}]'::jsonb));
  v := public.liga_law_decide_sys(did, true, adm);
  r := r || jsonb_build_object('beta_status', v->>'status' = 'beta',
    'beta_not_public', not exists (select 1 from public.liga_news_list() l where l.id = did),
    'beta_owner_sees', exists (select 1 from public.liga_law_beta(pid, tok) l where l.id = did),
    'beta_not_due', not exists (select 1 from public.liga_law_due_sys() d where d.id = did));
  v := public.liga_law_start(pid, tok, did, 'uz');
  r := r || jsonb_build_object('beta_owner_start', jsonb_array_length(v->'items') = 1);
  update public.safari_players set phone = '+998900009911' where id = pid;
  r := r || jsonb_build_object('beta_other_no_list', not exists (select 1 from public.liga_law_beta(pid, tok)));
  v := public.liga_chk_create_sys(777000222, 'X', 'Sinov MChJ', 'uz');
  r := r || jsonb_build_object('beta_chk_blocked', v->>'err' = 'beta', 'beta_chk_admin', public.liga_beta_sys(adm) and not public.liga_beta_sys(777000222));

  raise exception 'DQT_TEST %', r;
end $t$;
