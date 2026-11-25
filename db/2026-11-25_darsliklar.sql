-- 2026-11-25: «Darsliklar» — o'tgan kunlarning darsliklari (nazariya) va provodka mashqi, Asosiy oynada.
-- Faqat o'tgan kunlar (day < liga_today()): bugungi va kelgusi bosqich savollari ochilmaydi.
-- Javoblar ilovaga oldindan berilmaydi: har javob serverda tekshiriladi, to'g'ri javob faqat shundan keyin qaytadi.
-- Mashq ballari ligaga qo'shilmaydi; progress telefonda saqlanadi (boshidan boshlash mumkin).

-- 1) ro'yxat: mavzu, daraja, provodkalar soni (nazariyasiz — trafik kam)
create or replace function public.liga_lessons(p_id uuid, p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  return coalesce((
    select json_agg(json_build_object('day', p.day, 'level', p.level, 'icon', p.icon, 'title', p.title,
             'n', (select count(*) from public.liga_bank b where b.pool = p.pool and b.active and b.t = 'pv')) order by p.day)
    from public.liga_day_plan p where p.day < public.liga_today()), '[]'::json);
end $$;

-- 2) bitta darslik: nazariya, hikoya va provodka savollari (JAVOBSIZ)
create or replace function public.liga_lesson_get(p_id uuid, p_token text, p_day date, p_lang text)
returns json language plpgsql stable security definer set search_path = public as $$
declare p public.liga_day_plan; l text := case when p_lang = 'ru' then 'ru' else 'uz' end;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select * into p from public.liga_day_plan where day = p_day and day < public.liga_today();
  if not found then raise exception 'not_found'; end if;
  return json_build_object('day', p.day, 'level', p.level, 'icon', p.icon, 'title', p.title->>l,
    'story', p.story->>l, 'theory', p.theory->>l,
    'items', coalesce((select json_agg(json_build_object('id', b.id, 'q', b.uz->>'q', 'q_ru', b.ru->>'q', 'o', b.uz->'o') order by b.id)
      from public.liga_bank b where b.pool = p.pool and b.active and b.t = 'pv'), '[]'::json));
end $$;

-- 3) javobni tekshirish: to'g'rimi + to'g'ri provodka va izoh
create or replace function public.liga_lesson_check(p_id uuid, p_token text, p_qid text, p_dt text, p_kt text, p_lang text)
returns json language plpgsql stable security definer set search_path = public as $$
declare b public.liga_bank; l text := case when p_lang = 'ru' then 'ru' else 'uz' end;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select x.* into b from public.liga_bank x join public.liga_day_plan p on p.pool = x.pool
   where x.id = p_qid and x.active and x.t = 'pv' and p.day < public.liga_today();
  if not found then raise exception 'not_found'; end if;
  return json_build_object('ok', coalesce(p_dt, '') = b.dt and coalesce(p_kt, '') = b.kt, 'dt', b.dt, 'kt', b.kt,
    'e', case when l = 'ru' then b.ru->>'e' else b.uz->>'e' end);
end $$;

revoke all on function public.liga_lessons(uuid, text), public.liga_lesson_get(uuid, text, date, text),
  public.liga_lesson_check(uuid, text, text, text, text, text) from public;
grant execute on function public.liga_lessons(uuid, text), public.liga_lesson_get(uuid, text, date, text),
  public.liga_lesson_check(uuid, text, text, text, text, text) to anon, authenticated, service_role;
