import { Receipt, Wallet, Factory, Package, Landmark, Globe, BookOpen, Users, MonitorCog } from "lucide-react";
import { S } from "../engine/state";
import { t } from "../lib/i18n";
import { go, toast } from "../lib/nav";
import { C, startTopic, customTasks } from "../engine/run";
import { PageTitle } from "../components/ui";
import { isWeekend } from "../engine/time";

const IC: Record<string, any> = { qqs: Receipt, ish: Wallet, av: Factory, tmz: Package, sol: Landmark, mhxs: Globe, pro: BookOpen, jamoa: Users, amaliyot: MonitorCog };
export default function Topics() {
  const c = C(), cq = customTasks();
  const list = c.TOPICS.map((x) => ({ id: x.id, title: x.title, n: x.tasks.length })).concat(cq.length ? [{ id: "jamoa", title: t("Jamoa savollari"), n: cq.length }] : []);
  return (
    <div className="shell bare">
      <PageTitle title={t("Yo'nalishlar")} />
      <p className="small muted" style={{ fontWeight: 600, marginBottom: 12 }}>{t("Mavzu bo'yicha 10 ta savol. Ball kunlik mashq hisobiga yoziladi — liga jamiga qo'shilmaydi.")}{isWeekend() ? " " + t("Dam olish kuni — XP berilmaydi.") : ""}</p>
      <div className="tiles">
        {list.map((x) => { const Ic = IC[x.id] || BookOpen, a = S.tacc[x.id], pc = a && a.n ? Math.round((a.ok / a.n) * 100) : null;
          return (
            <button key={x.id} className="tile" data-tp={x.id} onClick={() => { const r = startTopic(x.id); if (typeof r === "string") toast(t(r)); else go("quiz", { run: r }); }}>
              <span className="ic"><Ic size={20} /></span><b>{x.title}</b><i>{t("{n} savol", { n: x.n })}{pc != null ? " · " + pc + "%" : ""}</i>
            </button>); })}
      </div>
    </div>
  );
}
