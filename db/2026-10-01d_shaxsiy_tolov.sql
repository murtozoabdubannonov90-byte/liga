-- Hisobchi Liga: har bir ishtirokchi uchun shaxsiy obuna (oyiga 30 000 so'm)
-- Tartib: ro'yxatdan o'tadi → kartaga pul o'tkazadi → chek rasmini yuboradi → ligaga qo'shiladi.
-- Admin chekni ko'radi: soxta bo'lsa — «Rad etish» (obuna bekor qilinadi).
-- Jamoa (ASOSIY'dan boshqa) a'zolari uchun jamoa obunasi amal qiladi.

alter table public.safari_players add column if not exists paid_until date;
-- hozirgi ishtirokchilar (01.10.2026 gacha ro'yxatdan o'tganlar): shu hafta oxirigacha — 04.10.2026
create or replace function public.liga_eff_until(p_until date, p_created timestamptz) returns date language sql immutable as $$
  select coalesce(p_until, case when p_created < timestamptz '2026-10-01 18:00+05' then date '2026-10-04' end)
$$;

alter table public.liga_invoices add column if not exists player_id uuid references public.safari_players(id) on delete cascade;
alter table public.liga_invoices add column if not exists receipt text;          -- chek rasmi (siqilgan JPEG, data URI)
alter table public.liga_invoices add column if not exists prev_until date;       -- rad etilsa qaytariladigan sana
alter table public.liga_invoices add column if not exists note text;

insert into public.liga_bot_config(key, value) values ('pay_card', ''), ('pay_card_name', '')
on conflict (key) do nothing;

-- shaxsiy to'lov kerakmi va to'langanmi
create or replace function public.liga_player_ok(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.group_code <> 'ASOSIY' then public.liga_group_ok(s.group_code)
                               else coalesce(public.liga_eff_until(s.paid_until, s.created_at) >= public.liga_today(), false) end
                   from public.safari_players s where s.id = p_id), false)
$$;

create or replace function public.liga_player_status(p_id uuid)
returns table(paid_until date, ok boolean, personal boolean, price int, pending boolean)
language sql stable security definer set search_path = public as $$
  select public.liga_eff_until(s.paid_until, s.created_at), public.liga_player_ok(s.id), s.group_code = 'ASOSIY',
         (select value::int from public.liga_bot_config where key = 'price_per_member'),
         exists (select 1 from public.liga_invoices i where i.player_id = s.id and i.status = 'check')
  from public.safari_players s where s.id = p_id
$$;

create or replace function public.liga_pay_config2()
returns table(payme_merchant_id text, click_service_id text, click_merchant_id text, price int, card text, card_name text)
language sql stable security definer set search_path = public as $$
  select (select value from public.liga_bot_config where key = 'payme_merchant_id'),
         (select value from public.liga_bot_config where key = 'click_service_id'),
         (select value from public.liga_bot_config where key = 'click_merchant_id'),
         (select value::int from public.liga_bot_config where key = 'price_per_member'),
         (select value from public.liga_bot_config where key = 'pay_card'),
         (select value from public.liga_bot_config where key = 'pay_card_name')
$$;

-- obunani uzaytirish (bugundan yoki joriy muddatdan)
create or replace function public.liga_player_extend(p_id uuid, p_months int) returns date
language sql security definer set search_path = public as $$
  update public.safari_players set paid_until =
    greatest(coalesce(public.liga_eff_until(paid_until, created_at), public.liga_today() - 1), public.liga_today() - 1) + 30 * greatest(1, p_months)
  where id = p_id returning paid_until
$$;

-- ishtirokchi chek yuboradi → darhol ligaga qo'shiladi (admin keyin tekshiradi)
create or replace function public.liga_receipt_submit(p_id uuid, p_token text, p_months int, p_image text)
returns table(id bigint, paid_until date)
language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 12)); pr int; g text; prev date; nu date; inv bigint;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  if p_image is null or p_image !~ '^data:image/(jpeg|png|webp);base64,' or length(p_image) > 1500000 then raise exception 'bad_image'; end if;
  if (select count(*) from public.liga_invoices i where i.player_id = p_id and i.created_at > now() - interval '1 day') >= 5 then raise exception 'too_many'; end if;
  select s.group_code, s.paid_until into g, prev from public.safari_players s where s.id = p_id;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_id, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, paid_at)
    values (g, 1, m, pr::bigint * m, 'check', 'karta', p_id, p_image, prev, now()) returning liga_invoices.id into inv;
  return query select inv, nu;
end $$;

-- admin: tekshirilmagan cheklar
create or replace function public.liga_admin_receipts(p_pin text)
returns table(id bigint, player_id uuid, name text, phone text, months int, amount bigint, receipt text, status text, created_at timestamptz, paid_until date)
language plpgsql security definer set search_path = public as $$
declare g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  return query select i.id, s.id, trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')), s.phone, i.months, i.amount, i.receipt, i.status, i.created_at, s.paid_until
    from public.liga_invoices i join public.safari_players s on s.id = i.player_id
    where s.group_code = g and i.receipt is not null and (i.status = 'check' or i.created_at > now() - interval '7 days')
    order by (i.status = 'check') desc, i.created_at desc limit 30;
end $$;

-- admin: chekni tasdiqlash yoki rad etish (rad etilsa obuna avvalgi holatiga qaytadi)
create or replace function public.liga_admin_receipt_decide(p_pin text, p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare inv record; g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  select i.* into inv from public.liga_invoices i join public.safari_players s on s.id = i.player_id
    where i.id = p_id and s.group_code = g and i.status = 'check' for update of i;
  if inv is null then return; end if;
  if p_ok then
    update public.liga_invoices set status = 'paid' where id = p_id;
  else
    update public.liga_invoices set status = 'cancelled', note = 'chek rad etildi' where id = p_id;
    update public.safari_players set paid_until = inv.prev_until where id = inv.player_id;
  end if;
end $$;

-- admin: naqd/boshqa yo'l bilan to'laganni qo'lda qo'shish
create or replace function public.liga_admin_player_pay(p_pin text, p_id uuid, p_months int) returns date
language plpgsql security definer set search_path = public as $$
declare g text; s record; m int := greatest(1, least(coalesce(p_months,1), 12)); nu date; pr int;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return null; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  select * into s from public.safari_players where id = p_id and group_code = g;
  if s is null then return null; end if;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_id, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, prev_until, paid_at, note)
    values (g, 1, m, pr::bigint * m, 'paid', 'qo''lda', p_id, s.paid_until, now(), 'admin qo''shdi');
  return nu;
end $$;

-- superadmin: karta raqamini kiritish
create or replace function public.liga_super_set_card(p_pin text, p_card text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.liga_pin_role(p_pin) is distinct from 'super' then return; end if;
  update public.liga_bot_config set value = left(regexp_replace(coalesce(p_card,''), '[^0-9 ]', '', 'g'), 30) where key = 'pay_card';
  update public.liga_bot_config set value = left(trim(coalesce(p_name,'')), 60) where key = 'pay_card_name';
end $$;

-- to'lov tizimi orqali (Payme/Click) shaxsiy hisob
create or replace function public.liga_my_invoice(p_id uuid, p_token text, p_months int default 1)
returns table(id bigint, amount bigint, months int)
language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 12)); pr int; g text; inv bigint;
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select group_code into g from public.safari_players where id = p_id;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  insert into public.liga_invoices(group_code, members, months, amount, player_id) values (g, 1, m, pr::bigint * m, p_id)
    returning liga_invoices.id into inv;
  return query select inv, pr::bigint * m, m;
end $$;

create or replace function public.liga_invoice_paid(p_invoice bigint, p_provider text, p_tx text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.liga_invoices where id = p_invoice for update;
  if inv is null or inv.status <> 'new' then return false; end if;
  update public.liga_invoices set status = 'paid', provider = p_provider, provider_tx = p_tx, paid_at = now() where id = p_invoice;
  if inv.player_id is not null then perform public.liga_player_extend(inv.player_id, inv.months);
  else perform public.liga_extend(inv.group_code, 30 * inv.months); end if;
  return true;
end $$;

-- natijani saqlash: to'lanmagan ishtirokchining bosqich ballari ligaga yozilmaydi
create or replace function public.liga_save(p_id uuid, p_token text, p_xp int, p_stages int, p_streak int, p_first text, p_last text,
  p_week_daily int, p_week_blitz int, p_week_bonus int, p_week_stages jsonb, p_region text default null, p_acc_ok int default 0, p_acc_total int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare g text; allowed int[]; k text; v int; st jsonb := '{}'::jsonb; wid text := public.liga_cur_week_id();
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  select group_code into g from public.safari_players where id = p_id;
  if public.liga_player_ok(p_id) then
    allowed := public.liga_allowed_stages(g);
    for k, v in select key, coalesce((value)::text::int, 0) from jsonb_each(coalesce(p_week_stages, '{}'::jsonb)) loop
      if k ~ '^\d+$' and k::int = any(allowed) then st := st || jsonb_build_object(k, greatest(0, least(v, 450))); end if;
    end loop;
  else
    select coalesce(s.week_stages, '{}'::jsonb) into st from public.safari_players s where s.id = p_id and s.week_id = wid;
    st := coalesce(st, '{}'::jsonb);
  end if;
  update public.safari_players set xp = greatest(0, p_xp), week_id = wid, week_stages = st,
    week_daily = greatest(0, coalesce(p_week_daily,0)), week_blitz = greatest(0, coalesce(p_week_blitz,0)), week_bonus = greatest(0, coalesce(p_week_bonus,0)),
    stages = greatest(0, p_stages), streak = greatest(0, p_streak), last_active = now(),
    first_name = coalesce(nullif(trim(p_first),''), first_name), last_name = coalesce(p_last, last_name),
    region = coalesce(public.liga_region_ok(p_region), region),
    acc_ok = greatest(0, coalesce(p_acc_ok,0)), acc_total = greatest(0, coalesce(p_acc_total,0))
  where id = p_id;
end $$;

-- admin ro'yxati: obuna holati bilan
create or replace function public.liga_admin_list2(p_pin text)
returns table(id uuid, first_name text, last_name text, phone text, xp integer, week_xp integer, week_id text, stages integer, streak integer,
  last_active timestamptz, created_at timestamptz, week_stage integer, week_daily integer, week_blitz integer, week_stages jsonb, week_bonus integer,
  region text, acc_ok int, acc_total int, has_device boolean, paid_until date, pay_ok boolean)
language plpgsql security definer set search_path to 'public' as $$
declare g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  return query select s.id, s.first_name, s.last_name, s.phone, s.xp, s.week_xp, s.week_id, s.stages, s.streak, s.last_active, s.created_at,
    coalesce(s.week_stage,0), coalesce(s.week_daily,0), coalesce(s.week_blitz,0), coalesce(s.week_stages,'{}'::jsonb), coalesce(s.week_bonus,0),
    s.region, s.acc_ok, s.acc_total, s.token_hash is not null, public.liga_eff_until(s.paid_until, s.created_at), public.liga_player_ok(s.id)
    from public.safari_players s where s.group_code = g order by s.created_at;
end $$;

-- huquqlar
revoke all on function public.liga_player_ok(uuid), public.liga_player_extend(uuid,int), public.liga_eff_until(date,timestamptz) from public, anon, authenticated;
grant execute on function public.liga_player_ok(uuid), public.liga_player_extend(uuid,int), public.liga_eff_until(date,timestamptz) to service_role;
revoke all on function public.liga_player_status(uuid), public.liga_pay_config2(), public.liga_receipt_submit(uuid,text,int,text),
  public.liga_admin_receipts(text), public.liga_admin_receipt_decide(text,bigint,boolean), public.liga_admin_player_pay(text,uuid,int),
  public.liga_super_set_card(text,text,text), public.liga_my_invoice(uuid,text,int), public.liga_save(uuid,text,integer,integer,integer,text,text,integer,integer,integer,jsonb,text,integer,integer),
  public.liga_admin_list2(text) from public;
grant execute on function public.liga_player_status(uuid), public.liga_pay_config2(), public.liga_receipt_submit(uuid,text,int,text),
  public.liga_admin_receipts(text), public.liga_admin_receipt_decide(text,bigint,boolean), public.liga_admin_player_pay(text,uuid,int),
  public.liga_super_set_card(text,text,text), public.liga_my_invoice(uuid,text,int), public.liga_save(uuid,text,integer,integer,integer,text,text,integer,integer,integer,jsonb,text,integer,integer),
  public.liga_admin_list2(text) to anon, authenticated, service_role;
revoke all on function public.liga_invoice_paid(bigint,text,text) from public, anon, authenticated;
grant execute on function public.liga_invoice_paid(bigint,text,text) to service_role;
