// Hisobchi Liga — obuna to'lovlari: Payme (Merchant API) va Click (SHOP API)
// Manzillar:  .../functions/v1/liga-pay/payme   va   .../functions/v1/liga-pay/click/prepare | /click/complete
// Maxfiy kalitlar Supabase Secrets'da: PAYME_KEY (kassa kaliti), CLICK_SECRET (secret key)
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const PAYME_KEY = Deno.env.get("PAYME_KEY") ?? "";
const PAYME_TEST_KEY = Deno.env.get("PAYME_TEST_KEY") ?? "";
const CLICK_SECRET = Deno.env.get("CLICK_SECRET") ?? "";
const TIMEOUT = 43_200_000; // 12 soat

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const msg = (t: string) => ({ uz: t, ru: t, en: t });

async function invoice(id: number) {
  const { data } = await db.from("liga_invoices").select("*").eq("id", id).maybeSingle();
  return data as null | { id: number; amount: number; status: string; group_code: string };
}
async function paid(id: number, provider: string, tx: string) {
  const { data, error } = await db.rpc("liga_invoice_paid", { p_invoice: id, p_provider: provider, p_tx: tx });
  if (error) throw error;
  return data;
}

// ---------------- Payme ----------------
async function payme(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = body?.id ?? null, method = body?.method, p = body?.params ?? {};
  const err = (code: number, text: string, data?: string) => json({ id, error: { code, message: msg(text), data } });
  const auth = req.headers.get("authorization") ?? "";
  const pass = (() => { try { return atob(auth.replace(/^Basic\s+/i, "")).split(":").slice(1).join(":"); } catch { return ""; } })();
  if (!PAYME_KEY || !(pass === PAYME_KEY || (PAYME_TEST_KEY && pass === PAYME_TEST_KEY))) return err(-32504, "Ruxsat yo'q");

  const txRow = async (tid: string) => (await db.from("liga_payme_tx").select("*").eq("id", tid).maybeSingle()).data;
  const txOut = (t: any) => ({ create_time: Number(t.create_time), perform_time: Number(t.perform_time), cancel_time: Number(t.cancel_time),
    transaction: String(t.id), state: t.state, reason: t.reason ?? null });
  const checkAcc = async () => {
    const inv = await invoice(Number(p?.account?.invoice_id));
    if (!inv) return { e: err(-31050, "Hisob topilmadi", "invoice_id") };
    if (inv.status !== "new") return { e: err(-31051, "Hisob allaqachon to'langan yoki bekor qilingan", "invoice_id") };
    if (Number(p.amount) !== Number(inv.amount) * 100) return { e: err(-31001, "Summa noto'g'ri") };
    return { inv };
  };

  switch (method) {
    case "CheckPerformTransaction": {
      const c = await checkAcc(); if (c.e) return c.e;
      return json({ id, result: { allow: true } });
    }
    case "CreateTransaction": {
      const ex = await txRow(String(p.id));
      if (ex) {
        if (ex.state !== 1) return err(-31008, "Tranzaksiyani bajarib bo'lmaydi");
        if (Date.now() - Number(ex.create_time) > TIMEOUT) {
          await db.from("liga_payme_tx").update({ state: -1, cancel_time: Date.now(), reason: 4 }).eq("id", ex.id);
          return err(-31008, "Tranzaksiya muddati o'tgan");
        }
        return json({ id, result: { create_time: Number(ex.create_time), transaction: String(ex.id), state: ex.state } });
      }
      const c = await checkAcc(); if (c.e) return c.e;
      const { data: other } = await db.from("liga_payme_tx").select("id").eq("invoice_id", c.inv!.id).eq("state", 1).limit(1);
      if (other && other.length) return err(-31050, "Bu hisob bo'yicha boshqa to'lov kutilmoqda", "invoice_id");
      const t = { id: String(p.id), invoice_id: c.inv!.id, amount: Number(p.amount), state: 1, create_time: Number(p.time) || Date.now() };
      const { error } = await db.from("liga_payme_tx").insert(t);
      if (error) return err(-31008, "Saqlab bo'lmadi");
      return json({ id, result: { create_time: t.create_time, transaction: t.id, state: 1 } });
    }
    case "PerformTransaction": {
      const t = await txRow(String(p.id));
      if (!t) return err(-31003, "Tranzaksiya topilmadi");
      if (t.state === 2) return json({ id, result: { transaction: String(t.id), perform_time: Number(t.perform_time), state: 2 } });
      if (t.state !== 1) return err(-31008, "Tranzaksiyani bajarib bo'lmaydi");
      if (Date.now() - Number(t.create_time) > TIMEOUT) {
        await db.from("liga_payme_tx").update({ state: -1, cancel_time: Date.now(), reason: 4 }).eq("id", t.id);
        return err(-31008, "Tranzaksiya muddati o'tgan");
      }
      await paid(Number(t.invoice_id), "payme", String(t.id));
      const now = Date.now();
      await db.from("liga_payme_tx").update({ state: 2, perform_time: now }).eq("id", t.id);
      return json({ id, result: { transaction: String(t.id), perform_time: now, state: 2 } });
    }
    case "CancelTransaction": {
      const t = await txRow(String(p.id));
      if (!t) return err(-31003, "Tranzaksiya topilmadi");
      if (t.state === 2) return err(-31007, "To'lov bajarilgan — obuna faollashtirilgan, bekor qilib bo'lmaydi");
      if (t.state < 0) return json({ id, result: { transaction: String(t.id), cancel_time: Number(t.cancel_time), state: t.state } });
      const now = Date.now();
      await db.from("liga_payme_tx").update({ state: -1, cancel_time: now, reason: p.reason ?? null }).eq("id", t.id);
      return json({ id, result: { transaction: String(t.id), cancel_time: now, state: -1 } });
    }
    case "CheckTransaction": {
      const t = await txRow(String(p.id));
      if (!t) return err(-31003, "Tranzaksiya topilmadi");
      return json({ id, result: txOut(t) });
    }
    case "GetStatement": {
      const { data } = await db.from("liga_payme_tx").select("*").gte("create_time", Number(p.from)).lte("create_time", Number(p.to)).order("create_time");
      return json({ id, result: { transactions: (data ?? []).map((t: any) => ({ id: String(t.id), time: Number(t.create_time), amount: Number(t.amount),
        account: { invoice_id: String(t.invoice_id) }, ...txOut(t) })) } });
    }
    default:
      return err(-32601, "Metod topilmadi");
  }
}

// ---------------- Click ----------------
async function click(req: Request, step: "prepare" | "complete") {
  const f = Object.fromEntries((await req.formData().catch(() => new FormData())).entries()) as Record<string, string>;
  const out = (error: number, error_note: string, extra: Record<string, unknown> = {}) =>
    json({ click_trans_id: f.click_trans_id, merchant_trans_id: f.merchant_trans_id, error, error_note, ...extra });
  if (!CLICK_SECRET) return out(-8, "Sozlanmagan");
  const base = f.click_trans_id + f.service_id + CLICK_SECRET + f.merchant_trans_id;
  const sign = step === "prepare"
    ? md5(base + f.amount + f.action + f.sign_time)
    : md5(base + f.merchant_prepare_id + f.amount + f.action + f.sign_time);
  if (sign !== f.sign_string) return out(-1, "SIGN CHECK FAILED");
  if (String(f.action) !== (step === "prepare" ? "0" : "1")) return out(-3, "Action not found");
  const inv = await invoice(Number(f.merchant_trans_id));
  if (!inv) return out(-5, "User does not exist");
  if (Math.abs(Number(f.amount) - Number(inv.amount)) > 0.01) return out(-2, "Incorrect parameter amount");

  if (step === "prepare") {
    if (inv.status === "paid") return out(-4, "Already paid");
    if (inv.status !== "new") return out(-9, "Transaction cancelled");
    await db.from("liga_click_tx").upsert({ click_trans_id: Number(f.click_trans_id), invoice_id: inv.id, amount: Number(f.amount), state: 0 });
    return out(0, "Success", { merchant_prepare_id: inv.id });
  }
  const { data: t } = await db.from("liga_click_tx").select("*").eq("click_trans_id", Number(f.click_trans_id)).maybeSingle();
  if (!t || Number(f.merchant_prepare_id) !== inv.id) return out(-6, "Transaction does not exist");
  if (t.state === 1) return out(-4, "Already paid", { merchant_confirm_id: inv.id });
  if (Number(f.error) < 0) {
    await db.from("liga_click_tx").update({ state: -1 }).eq("click_trans_id", t.click_trans_id);
    return out(-9, "Transaction cancelled");
  }
  if (inv.status === "paid") return out(-4, "Already paid", { merchant_confirm_id: inv.id });
  await paid(inv.id, "click", String(f.click_trans_id));
  await db.from("liga_click_tx").update({ state: 1 }).eq("click_trans_id", t.click_trans_id);
  return out(0, "Success", { merchant_confirm_id: inv.id });
}

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname;
  try {
    if (req.method !== "POST") return json({ ok: true, service: "liga-pay" });
    if (path.endsWith("/payme")) return await payme(req);
    if (path.endsWith("/click/prepare")) return await click(req, "prepare");
    if (path.endsWith("/click/complete")) return await click(req, "complete");
    return json({ error: "not found" }, 404);
  } catch (e) {
    console.error(e);
    return path.endsWith("/payme") ? json({ id: null, error: { code: -32400, message: msg("Ichki xato") } }) : json({ error: -7, error_note: "Failed to update user" });
  }
});
