-- 4 kishilik duel — server sinovi. Migratsiyadan keyin (yoki u bilan birga) ishga tushiriladi;
-- oxirida ataylab xato chiqarib, hamma o'zgarishni bekor qiladi (bazada hech narsa qolmaydi).
-- Natija xato xabarida: "QUAD_TEST {...}" — har bir tekshiruv true bo'lishi kerak.
do $t$
declare ids uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  tok text[] := array['qt1','qt2','qt3','qt4','qt5']; c text; v jsonb; r jsonb := '{}'; i int; q public.liga_quad; b public.liga_bank;
  n_pv int; n_ot int; bad_pool int; ans jsonb; wrong jsonb;
begin
  for i in 1..5 loop
    insert into public.safari_players(id, first_name, last_name, phone, token_hash, paid_until, lang)
      values (ids[i], 'Sinov' || i, 'Q', '+99890000000' || i, public.liga_hash(tok[i]), public.liga_today() + 5, 'uz');
  end loop;
  -- 1) yaratish: egasi 1-o'rinda
  c := public.liga_quad_create(ids[1], tok[1], 'uz');
  v := public.liga_quad_state(ids[1], tok[1], c);
  r := r || jsonb_build_object('create', c ~ '^Q[A-Z0-9]{6}$' and v->>'status' = 'wait' and (v->>'me')::int = 1 and (v->>'is_host')::boolean);
  -- 2) yana 3 kishi havola orqali kiradi, 5-chi tomoshabin bo'ladi
  for i in 2..4 loop v := public.liga_quad_state(ids[i], tok[i], c); end loop;
  r := r || jsonb_build_object('join3', (v->>'me')::int = 4 and jsonb_array_length(v->'players') = 4);
  -- to'rttasi ham ilovada → o'zi boshlanadi (tick)
  r := r || jsonb_build_object('auto_start', v->>'status' = 'play');
  v := public.liga_quad_state(ids[5], tok[5], c);
  r := r || jsonb_build_object('spectator', v->'me' is null and jsonb_array_length(v->'players') = 4);
  -- 3) savollar: 20 ta, avval 15 provodka, keyin 5 savol, faqat o'tgan mavzulardan
  select * into q from public.liga_quad where code = c;
  select count(*) filter (where k <= 15 and bk.t = 'pv'), count(*) filter (where k > 15 and bk.t <> 'pv'),
         count(*) filter (where bk.pool ~ '^d' and to_date(substr(bk.pool, 2), 'YYYYMMDD') >= public.liga_today())
    into n_pv, n_ot, bad_pool
    from unnest(q.qids) with ordinality u(id, k) join public.liga_bank bk on bk.id = u.id;
  r := r || jsonb_build_object('q20', array_length(q.qids, 1) = 20, 'pv15', n_pv = 15, 'other5', n_ot = 5, 'past_only', bad_pool = 0);
  -- savol hali ochilmagan (4 soniya tayyorlanish) — javob «late»
  v := public.liga_quad_answer(ids[2], tok[2], c, 0, '{}');
  r := r || jsonb_build_object('early_late', v->>'why' = 'late');
  -- 4) savolni ochamiz; 2-o'yinchi birinchi to'g'ri topadi → +1, hammaga keyingi savol
  update public.liga_quad set q_at = now() - interval '1 second' where code = c;
  select * into b from public.liga_bank where id = q.qids[1];
  ans := case b.t when 'pv' then jsonb_build_object('dt', b.dt, 'kt', b.kt) when 'mc' then jsonb_build_object('pick', b.a) else jsonb_build_object('val', b.a::text) end;
  wrong := case b.t when 'pv' then jsonb_build_object('dt', b.kt, 'kt', b.dt) when 'mc' then jsonb_build_object('pick', b.a + 1) else jsonb_build_object('val', (b.a + 1)::text) end;
  v := public.liga_quad_answer(ids[3], tok[3], c, 0, wrong);
  r := r || jsonb_build_object('wrong_locks', v->>'why' = 'wrong' and (v->>'locked')::boolean and (v->>'cur')::int = 0);
  v := public.liga_quad_answer(ids[3], tok[3], c, 0, ans);
  r := r || jsonb_build_object('locked_no_retry', v->>'why' = 'locked');
  v := public.liga_quad_answer(ids[2], tok[2], c, 0, ans);
  r := r || jsonb_build_object('first_right', (v->>'ok')::boolean and (v->>'cur')::int = 1
    and (select pts from public.liga_quad_p where code = c and pid = ids[2]) = 1 and (v->'last'->>'w')::int = 2
    and v->'last'->>'w_name' = 'Sinov2 Q.' and v->'item' is null);
  -- kechikkan javob (oldingi savolga) qabul qilinmaydi
  v := public.liga_quad_answer(ids[4], tok[4], c, 0, ans);
  r := r || jsonb_build_object('late_after_win', v->>'why' = 'late' and (select pts from public.liga_quad_p where code = c and pid = ids[4]) = 0);
  -- 5) 2-savol: hamma (4 kishi) xato qilsa — keyingi savolga o'tiladi
  update public.liga_quad set q_at = now() - interval '1 second' where code = c;
  select * into b from public.liga_bank where id = q.qids[2];
  wrong := case b.t when 'pv' then jsonb_build_object('dt', b.kt, 'kt', b.dt) when 'mc' then jsonb_build_object('pick', b.a + 1) else jsonb_build_object('val', (b.a + 1)::text) end;
  for i in 1..3 loop v := public.liga_quad_answer(ids[i], tok[i], c, 1, wrong); end loop;
  r := r || jsonb_build_object('three_locked_wait', (v->>'cur')::int = 1);
  v := public.liga_quad_answer(ids[4], tok[4], c, 1, jsonb_build_object('left', true));
  r := r || jsonb_build_object('all_locked_next', (v->>'cur')::int = 2 and v->'last'->'w' is null);
  -- 6) qolgan savollar: 1-o'yinchi hammasini topadi → g'olib, reyting
  for i in 2..19 loop
    update public.liga_quad set q_at = now() - interval '1 second' where code = c;
    select * into b from public.liga_bank where id = q.qids[i + 1];
    ans := case b.t when 'pv' then jsonb_build_object('dt', b.dt, 'kt', b.kt) when 'mc' then jsonb_build_object('pick', b.a) else jsonb_build_object('val', b.a::text) end;
    v := public.liga_quad_answer(ids[1], tok[1], c, i, ans);
  end loop;
  r := r || jsonb_build_object('done', v->>'status' = 'done' and (v->>'winner')::int = 1 and (v->'rank'->>0)::int = 1 and (v->'rank'->>1)::int = 2
    and (select pts from public.liga_quad_p where code = c and pid = ids[1]) = 18);
  -- ro'yxat
  r := r || jsonb_build_object('list', (public.liga_quad_list(ids[2], tok[2]) -> 0 ->> 'place')::int = 2);
  -- 7) ikkinchi xona: egasi yolg'iz boshlay olmaydi; 2 kishi bo'lsa boshlaydi; egasi chiqsa yopiladi
  c := public.liga_quad_create(ids[1], tok[1], 'ru');
  begin perform public.liga_quad_start(ids[1], tok[1], c); r := r || '{"start_alone_blocked": false}';
  exception when others then r := r || jsonb_build_object('start_alone_blocked', sqlerrm = 'quad_few'); end;
  perform public.liga_quad_state(ids[2], tok[2], c);
  begin perform public.liga_quad_start(ids[2], tok[2], c); r := r || '{"start_not_host": false}';
  exception when others then r := r || jsonb_build_object('start_not_host', sqlerrm = 'not_host'); end;
  v := public.liga_quad_start(ids[1], tok[1], c);
  r := r || jsonb_build_object('start_two', v->>'status' = 'play' and array_length((select qids from public.liga_quad where code = c), 1) = 20);
  c := public.liga_quad_create(ids[3], tok[3], 'uz');
  perform public.liga_quad_state(ids[4], tok[4], c);
  perform public.liga_quad_leave(ids[4], tok[4], c);
  r := r || jsonb_build_object('leave_frees_seat', (select count(*) from public.liga_quad_p where code = c) = 1);
  perform public.liga_quad_leave(ids[3], tok[3], c);
  r := r || jsonb_build_object('host_leave_cancels', (select status = 'done' and note = 'cancel' from public.liga_quad where code = c));
  -- 8) obunasiz kira olmaydi, noto'g'ri kalit
  update public.safari_players set paid_until = public.liga_today() - 40, created_at = now() - interval '90 days' where id = ids[5];
  c := public.liga_quad_create(ids[3], tok[3], 'uz');
  begin perform public.liga_quad_state(ids[5], tok[5], c); r := r || jsonb_build_object('unpaid_blocked', public.liga_player_ok(ids[5]));
  exception when others then r := r || jsonb_build_object('unpaid_blocked', sqlerrm = 'unpaid'); end;
  begin perform public.liga_quad_state(ids[1], 'xato', c); r := r || '{"bad_token": false}';
  exception when others then r := r || jsonb_build_object('bad_token', sqlerrm = 'bad_token'); end;
  -- 9) 30 daqiqa ichida hech kim kelmasa — xona yopiladi
  update public.liga_quad set created_at = now() - interval '31 minutes' where code = c;
  v := public.liga_quad_state(ids[3], tok[3], c);
  r := r || jsonb_build_object('expired', v->>'status' = 'done' and v->>'note' = 'expired');
  raise exception 'QUAD_TEST %', r;
end $t$;
