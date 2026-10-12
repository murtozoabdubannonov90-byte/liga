-- 2026-10-12 · Soxta chekdan himoya
-- Avval: chek yuborilishi bilan obuna darhol uzayardi, admin rad etsa qaytarilardi —
--        shu oraliqda soxta chek bilan bosqich ochilib qolardi.
-- Endi:  chek faqat "tekshiruvda" (status = 'check') turadi, bosqichlar YOPIQ.
--        Admin bank ilovasida pul kartaga tushganini ko'rib «✅ Pul tushdi» bossagina obuna ochiladi.
--        + bir xil chek rasmi ikkinchi marta qabul qilinmaydi (rasm hash / Telegram file_unique_id)
--        + bitta o'yinchida bir vaqtda faqat bitta tekshiruvdagi chek
--        + 14 kunda 2 marta rad etilgan chek → 7 kun chek qabul qilinmaydi (admin bilan bog'lanish kerak)

alter table public.liga_invoices add column if not exists img_hash text;
alter table public.liga_invoices add column if not exists extended boolean not null default true;
create index if not exists liga_invoices_img_hash on public.liga_invoices(img_hash);

-- chek qabul qilinadimi? null — ha; aks holda sabab: dup | pending | blocked
create or replace function public.liga_receipt_guard(p_player uuid, p_hash text, p_uid text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.liga_invoices i
                 where (p_hash is not null and i.img_hash = p_hash) or (p_uid is not null and i.tg_file_uid = p_uid)) then 'dup'
    when exists (select 1 from public.liga_invoices i where i.player_id = p_player and i.status = 'check') then 'pending'
    when (select count(*) from public.liga_invoices i where i.player_id = p_player and i.status = 'cancelled'
            and i.note = 'chek rad etildi' and i.created_at > now() - interval '14 days') >= 2
         and exists (select 1 from public.liga_invoices i where i.player_id = p_player and i.status = 'cancelled'
            and i.note = 'chek rad etildi' and i.created_at > now() - interval '7 days') then 'blocked'
  end
$$;

-- obunani to'lov kunidan boshlab uzaytirish (admin kechroq tasdiqlasa ham kun yo'qolmaydi)
create or replace function public.liga_player_extend_from(p_id uuid, p_months int, p_from date)
returns date language sql security definer set search_path = public as $$
  update public.safari_players set paid_until =
    greatest(coalesce(public.liga_eff_until(paid_until, created_at), p_from - 1), p_from - 1, public.liga_today() - 1) + 30 * greatest(1, p_months)
  where id = p_id returning paid_until
$$;

-- ilovadan chek yuborish: endi obunani UZAYTIRMAYDI
create or replace function public.liga_receipt_submit(p_id uuid, p_token text, p_months integer, p_image text)
returns table(id bigint, paid_until date) language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 6)); pr int; g text; cur date; inv bigint; h text; why text;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_image is null or p_image !~ '^data:image/(jpeg|png|webp);base64,' or length(p_image) > 1500000 then raise exception 'bad_image'; end if;
  h := md5(p_image);
  why := public.liga_receipt_guard(p_id, h, null);
  if why is not null then raise exception 'receipt_%', why; end if;
  select s.group_code, s.paid_until into g, cur from public.safari_players s where s.id = p_id;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, img_hash, extended)
    values (g, 1, m, pr::bigint * m, 'check', 'karta', p_id, p_image, cur, h, false) returning liga_invoices.id into inv;
  begin perform public.liga_bot_call('receipt:' || inv); exception when others then null; end;
  return query select inv, cur;
end $$;

-- botdan chek yuborish (yangi nom — qaytaradigan ustunlar o'zgardi)
create or replace function public.liga_receipt2_sys(p_player uuid, p_months integer, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns table(id bigint, reason text) language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 6)); pr int; g text; cur date; inv bigint; h text; why text;
begin
  h := case when p_image is null then null else md5(p_image) end;
  why := public.liga_receipt_guard(p_player, h, p_uid);
  if why is not null then return query select null::bigint, why; return; end if;
  select s.group_code, s.paid_until into g, cur from public.safari_players s where s.id = p_player;
  if g is null then raise exception 'not_found'; end if;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, tg_file_uid, tg_file_id, tg_chat_id, img_hash, extended)
    values (g, 1, m, pr::bigint * m, 'check', 'karta (bot)', p_player, p_image, cur, p_uid, p_file_id, p_chat, h, false) returning liga_invoices.id into inv;
  return query select inv, null::text;
end $$;

-- eski bot funksiyasi ham yangi qoidaga bo'ysunsin (eski kod chaqirsa ham obuna ochilmaydi)
create or replace function public.liga_receipt_sys(p_player uuid, p_months integer, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns table(id bigint, paid_until date, dup boolean) language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.liga_receipt2_sys(p_player, p_months, p_image, p_uid, p_file_id, p_chat);
  return query select r.id, (select s.paid_until from public.safari_players s where s.id = p_player), r.reason is not null;
end $$;

-- qaror (umumiy): tasdiq → obuna ochiladi; rad → (agar eski usulda ochilgan bo'lsa) qaytariladi
create or replace function public.liga_receipt_apply(p_id bigint, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.* into inv from public.liga_invoices i where i.id = p_id for update;
  if inv is null or inv.status <> 'check' then return; end if;
  if p_ok then
    if not inv.extended then perform public.liga_player_extend_from(inv.player_id, inv.months, (inv.created_at at time zone 'Asia/Tashkent')::date); end if;
    update public.liga_invoices set status = 'paid', extended = true, paid_at = now() where liga_invoices.id = p_id;
    perform public.liga_ref_reward(inv.player_id);
  else
    update public.liga_invoices set status = 'cancelled', note = 'chek rad etildi' where liga_invoices.id = p_id;
    if inv.extended then update public.safari_players set paid_until = inv.prev_until where safari_players.id = inv.player_id; end if;
  end if;
end $$;

-- bot tugmalari orqali qaror (yangi nom: o'yinchiga xabar uchun obuna sanasi va til ham qaytadi)
create or replace function public.liga_receipt_decide2_sys(p_id bigint, p_ok boolean, p_admin_chat bigint)
returns table(done boolean, status text, player_chat bigint, name text, paid_until date, lang text)
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.* into inv from public.liga_invoices i where i.id = p_id;
  if inv is null or not exists (select 1 from public.liga_admin_chats a where a.chat_id = p_admin_chat and a.group_code = inv.group_code) then
    return query select false, null::text, null::bigint, null::text, null::date, null::text; return;
  end if;
  perform public.liga_receipt_apply(p_id, p_ok);
  return query select true, i.status, coalesce(inv.tg_chat_id, s.tg_user_id),
    trim(coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')), public.liga_eff_until(s.paid_until, s.created_at), s.lang
  from public.liga_invoices i join public.safari_players s on s.id = i.player_id where i.id = p_id;
end $$;

-- eski nom (moslik uchun) — yangi mantiq
create or replace function public.liga_receipt_decide_sys(p_id bigint, p_ok boolean, p_admin_chat bigint)
returns table(done boolean, status text, player_chat bigint, name text) language sql security definer set search_path = public as $$
  select d.done, d.status, d.player_chat, d.name from public.liga_receipt_decide2_sys(p_id, p_ok, p_admin_chat) d
$$;

-- ilovadagi admin panel orqali qaror
create or replace function public.liga_admin_receipt_decide(p_pin text, p_id bigint, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  if not exists (select 1 from public.liga_invoices i join public.safari_players s on s.id = i.player_id
                 where i.id = p_id and s.group_code = g and i.status = 'check') then return; end if;
  perform public.liga_receipt_apply(p_id, p_ok);
  begin perform public.liga_bot_call('receipt_done:' || p_id); exception when others then null; end;
end $$;

-- bot uchun: chek haqida admin xabari ma'lumotlari (oldingi rad etishlar soni)
create or replace function public.liga_receipt_info_sys(p_id bigint)
returns table(rejected int, paid int) language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.liga_invoices x where x.player_id = i.player_id and x.status = 'cancelled' and x.note = 'chek rad etildi'),
         (select count(*)::int from public.liga_invoices x where x.player_id = i.player_id and x.status = 'paid' and x.provider like 'karta%')
  from public.liga_invoices i where i.id = p_id
$$;

-- ichki funksiyalar faqat server/bot uchun (alohida migratsiya bilan qo'llangan)
revoke all on function public.liga_receipt_guard(uuid, text, text) from public, anon, authenticated;
revoke all on function public.liga_player_extend_from(uuid, int, date) from public, anon, authenticated;
revoke all on function public.liga_receipt2_sys(uuid, integer, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.liga_receipt_apply(bigint, boolean) from public, anon, authenticated;
revoke all on function public.liga_receipt_decide2_sys(bigint, boolean, bigint) from public, anon, authenticated;
revoke all on function public.liga_receipt_info_sys(bigint) from public, anon, authenticated;
revoke all on function public.liga_receipt_sys(uuid, integer, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.liga_receipt_decide_sys(bigint, boolean, bigint) from public, anon, authenticated;
