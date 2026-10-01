-- Hisobchi Liga: chekni Telegram bot orqali qabul qilish, adminga yuborish
create table if not exists public.liga_tg_links(
  code text primary key, kind text not null,                -- pay | adm
  player_id uuid references public.safari_players(id) on delete cascade,
  group_code text, created_at timestamptz not null default now(), used_at timestamptz);
create table if not exists public.liga_tg_sessions(
  chat_id bigint primary key, player_id uuid not null references public.safari_players(id) on delete cascade,
  months int not null default 1, updated_at timestamptz not null default now());
create table if not exists public.liga_admin_chats(
  chat_id bigint not null, group_code text not null references public.liga_groups(code) on update cascade,
  created_at timestamptz not null default now(), primary key (chat_id, group_code));
alter table public.liga_tg_links enable row level security;
alter table public.liga_tg_sessions enable row level security;
alter table public.liga_admin_chats enable row level security;
revoke all on public.liga_tg_links, public.liga_tg_sessions, public.liga_admin_chats from anon, authenticated;

alter table public.liga_invoices add column if not exists tg_file_uid text;
alter table public.liga_invoices add column if not exists tg_file_id text;
alter table public.liga_invoices add column if not exists tg_chat_id bigint;
create unique index if not exists liga_invoices_tg_uid on public.liga_invoices(tg_file_uid) where tg_file_uid is not null;

-- ilova: botga chek yuborish havolasi
create or replace function public.liga_tg_pay_link(p_id uuid, p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare c text := encode(extensions.gen_random_bytes(9), 'hex');
begin
  if not public.liga_auth(p_id, p_token) then raise exception 'bad_token'; end if;
  insert into public.liga_tg_links(code, kind, player_id) values (c, 'pay', p_id);
  return 'pay_' || c;
end $$;

-- admin: cheklarni Telegramda olish havolasi
create or replace function public.liga_admin_tg_link(p_pin text) returns text
language plpgsql security definer set search_path = public as $$
declare c text := encode(extensions.gen_random_bytes(9), 'hex'); g text;
begin
  if public.liga_pin_role(p_pin) is distinct from 'admin' then return null; end if;
  select code into g from public.liga_groups where admin_pin = p_pin;
  insert into public.liga_tg_links(code, kind, group_code) values (c, 'adm', g);
  return 'adm_' || c;
end $$;

-- bot (service_role): chek qabul qilish
create or replace function public.liga_receipt_sys(p_player uuid, p_months int, p_image text, p_uid text, p_file_id text, p_chat bigint)
returns table(id bigint, paid_until date, dup boolean)
language plpgsql security definer set search_path = public as $$
declare m int := greatest(1, least(coalesce(p_months,1), 12)); pr int; g text; prev date; nu date; inv bigint;
begin
  if exists (select 1 from public.liga_invoices i where i.tg_file_uid = p_uid) then
    return query select null::bigint, null::date, true; return;
  end if;
  select s.group_code, s.paid_until into g, prev from public.safari_players s where s.id = p_player;
  if g is null then raise exception 'not_found'; end if;
  select value::int into pr from public.liga_bot_config where key = 'price_per_member';
  nu := public.liga_player_extend(p_player, m);
  insert into public.liga_invoices(group_code, members, months, amount, status, provider, player_id, receipt, prev_until, paid_at, tg_file_uid, tg_file_id, tg_chat_id)
    values (g, 1, m, pr::bigint * m, 'check', 'karta (bot)', p_player, p_image, prev, now(), p_uid, p_file_id, p_chat) returning liga_invoices.id into inv;
  return query select inv, nu, false;
end $$;

-- bot (service_role): admin Telegramda tasdiqlaydi / rad etadi
create or replace function public.liga_receipt_decide_sys(p_id bigint, p_ok boolean, p_admin_chat bigint)
returns table(done boolean, status text, player_chat bigint, name text)
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.* into inv from public.liga_invoices i where i.id = p_id for update;
  if inv is null or not exists (select 1 from public.liga_admin_chats a where a.chat_id = p_admin_chat and a.group_code = inv.group_code) then
    return query select false, null::text, null::bigint, null::text; return;
  end if;
  if inv.status = 'check' then
    if p_ok then update public.liga_invoices set status = 'paid' where liga_invoices.id = p_id;
    else update public.liga_invoices set status = 'cancelled', note = 'chek rad etildi' where liga_invoices.id = p_id;
         update public.safari_players set paid_until = inv.prev_until where safari_players.id = inv.player_id; end if;
  end if;
  return query select true, (select i.status from public.liga_invoices i where i.id = p_id), inv.tg_chat_id,
    (select trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')) from public.safari_players s where s.id = inv.player_id);
end $$;

-- ilovadan yuklangan chek ham adminga Telegramda boradi
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
  begin perform public.liga_bot_call('receipt:' || inv); exception when others then null; end;
  return query select inv, nu;
end $$;

revoke all on function public.liga_tg_pay_link(uuid,text), public.liga_admin_tg_link(text) from public;
grant execute on function public.liga_tg_pay_link(uuid,text), public.liga_admin_tg_link(text) to anon, authenticated, service_role;
revoke all on function public.liga_receipt_sys(uuid,int,text,text,text,bigint), public.liga_receipt_decide_sys(bigint,boolean,bigint) from public, anon, authenticated;
grant execute on function public.liga_receipt_sys(uuid,int,text,text,text,bigint), public.liga_receipt_decide_sys(bigint,boolean,bigint) to service_role;
