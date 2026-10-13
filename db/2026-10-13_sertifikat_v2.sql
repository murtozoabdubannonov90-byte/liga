-- 2026-10-13 · Sertifikatlar v2: o'ringa qarab alohida dizayn, raqamli imzo, avtomatik berish, ishonchli tekshirish
-- * Haftalik kuchli uchlikka sertifikat juma 12:01 da avtomatik beriladi (liga_cert_issue_week_sys), bot g'olibga havola yuboradi.
-- * Har sertifikatning raqamli imzosi: HMAC-SHA256(serverdagi maxfiy kalit, sertifikat ma'lumotlari) — QR orqali ochilgan
--   sahifada server imzoni qayta hisoblab "mos" deb ko'rsatadi; ma'lumotni qo'lda o'zgartirgan soxta nusxa imzodan o'tmaydi.
-- * Tekshirish sahifasi shu haftaning butun kuchli uchligini ko'rsatadi (kim qaysi o'rinda) — solishtirib ishonch hosil qilinadi.

insert into public.liga_bot_config(key, value) values ('cert_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;
insert into public.liga_bot_config(key, value) values ('cert_signer', 'M. Abdubannonov')
on conflict (key) do nothing;

-- 2.10 haftasida Anvar E. aslida 2-o'rin (955 XP) — sertifikatda xato 3 yozilgan edi
update public.liga_certs set detail = '2|955|2026-10-02T07:00' where id = 'VCPB5HUX' and detail = '3|955|2026-10-02T07:00';

create or replace function public.liga_cert_sig(p_id text)
returns text language sql stable security definer set search_path = public, extensions as $$
  select upper(regexp_replace(substr(encode(extensions.hmac(
           c.id || '|' || c.player_id || '|' || c.kind || '|' || coalesce(c.ref, '') || '|' || coalesce(c.detail, '') || '|' || to_char(c.issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
           (select value from public.liga_bot_config where key = 'cert_secret'), 'sha256'), 'hex'), 1, 16), '(.{4})(?!$)', '\1-', 'g'))
  from public.liga_certs c where c.id = upper(trim(p_id))
$$;
revoke all on function public.liga_cert_sig(text) from public, anon, authenticated;

-- haftaning o'rinlari (jamoa bo'yicha) — sertifikat va zal uchun yagona tartib
create or replace function public.liga_week_rank(p_week text, p_code text)
returns table(pos int, player_id uuid, name text, xp int)
language sql stable security definer set search_path = public as $$
  select (row_number() over (order by r.week_xp desc, s.created_at))::int, r.player_id,
         trim(coalesce(s.first_name, '') || ' ' || coalesce(left(s.last_name, 1) || '.', '')), r.week_xp
  from public.liga_week_results r join public.safari_players s on s.id = r.player_id
  where r.week_id = p_week and r.group_code = p_code and r.week_xp > 0
$$;
revoke all on function public.liga_week_rank(text, text) from public, anon, authenticated;

-- juma: haftaning kuchli uchligiga sertifikat (takroran chaqirilsa yangisini yaratmaydi)
create or replace function public.liga_cert_issue_week_sys(p_week text)
returns table(cert text, pos int, player_id uuid, tg bigint, lang text, name text, xp int)
language plpgsql security definer set search_path = public as $$
declare g record; r record; c text;
begin
  for g in select distinct group_code from public.liga_week_results where week_id = p_week loop
    for r in select * from public.liga_week_rank(p_week, g.group_code) where liga_week_rank.pos <= 3 loop
      select x.id into c from public.liga_certs x where x.player_id = r.player_id and x.kind = 'week' and x.ref = p_week;
      if c is null then
        loop c := public.liga_short_code(8); exit when not exists (select 1 from public.liga_certs x where x.id = c); end loop;
        insert into public.liga_certs(id, player_id, kind, ref, title, detail) values (c, r.player_id, 'week', p_week, 'week', r.pos || '|' || r.xp || '|' || p_week);
      end if;
      return query select c, r.pos, r.player_id, s.tg_user_id, coalesce(s.lang, 'uz'), r.name, r.xp from public.safari_players s where s.id = r.player_id;
    end loop;
  end loop;
end $$;
revoke all on function public.liga_cert_issue_week_sys(text) from public, anon, authenticated;

-- QR orqali tekshirish (ro'yxatdan o'tish shart emas)
create or replace function public.liga_cert_verify2(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select x.*, s.first_name, s.last_name, s.group_code from public.liga_certs x join public.safari_players s on s.id = x.player_id
             where x.id = upper(trim(p_id))),
  d as (select c.*, split_part(c.detail, '|', 1) f1, split_part(c.detail, '|', 2) f2, split_part(c.detail, '|', 3) f3,
               case when c.kind = 'week' then to_date(substr(c.ref, 1, 10), 'YYYY-MM-DD') end fri from c)
  select case when not exists (select 1 from d) then jsonb_build_object('ok', false, 'checked_at', now()) else (
    select jsonb_build_object(
      'ok', true, 'id', d.id, 'kind', d.kind, 'issued_at', d.issued_at, 'checked_at', now(),
      'name', trim(coalesce(d.first_name, '') || ' ' || coalesce(d.last_name, '')),
      'team', (select g.name from public.liga_groups g where g.code = d.group_code),
      'sig', public.liga_cert_sig(d.id),
      'signer', (select value from public.liga_bot_config where key = 'cert_signer'),
      'place', case when d.kind = 'week' then nullif(d.f1, '')::int end,
      'xp', case when d.kind = 'week' then nullif(d.f2, '')::int else nullif(d.f1, '')::int end,
      'week', case when d.kind = 'week' then jsonb_build_object('id', d.ref, 'no', extract(week from d.fri)::int, 'from', d.fri - 4, 'to', d.fri) end,
      'participants', case when d.kind = 'week' then (select count(*) from public.liga_week_results r where r.week_id = d.ref and r.group_code = d.group_code and r.week_xp > 0) end,
      'serial', 'HL-' || coalesce(to_char(d.fri, 'IYYY-IW'), to_char(d.issued_at, 'YYYY')) || '-' || coalesce(d.f1, '0') || '-' || d.id,
      'peers', case when d.kind = 'week' then (select jsonb_agg(jsonb_build_object('pos', w.pos, 'n', w.name, 'me', w.player_id = d.player_id,
                  'cert', (select x.id from public.liga_certs x where x.player_id = w.player_id and x.kind = 'week' and x.ref = d.ref)) order by w.pos)
                from public.liga_week_rank(d.ref, d.group_code) w where w.pos <= 3) end)
    from d) end
$$;
grant execute on function public.liga_cert_verify2(text) to anon, authenticated;

-- o'tgan haftalar uchun ham (2.10 va 9.10) — avtomatik berish
select public.liga_cert_issue_week_sys('2026-10-02T07:00');
select public.liga_cert_issue_week_sys('2026-10-09T07:00');

-- 2.10 haftasidagi xato yozuv: Хаджаев У. natijasi "2026-10-02T09:00" degan alohida hafta bo'lib qolgan edi (zalda soxta 1-o'rin).
update public.liga_week_results set week_id = '2026-10-02T07:00' where week_id = '2026-10-02T09:00'
  and not exists (select 1 from public.liga_week_results x where x.week_id = '2026-10-02T07:00' and x.player_id = liga_week_results.player_id);
