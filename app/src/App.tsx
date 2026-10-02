import { AnimatePresence, motion } from "framer-motion";
import { Home as HomeI, Trophy, BookOpen, User } from "lucide-react";
import { useStore, S } from "./engine/state";
import { useNav, tab, isTab } from "./lib/nav";
import { t } from "./lib/i18n";
import { Toast } from "./components/ui";
import { entry } from "./boot";
import { LangPick, Register, AskRegion } from "./screens/Onboard";
import Home from "./screens/Home";
import Rating from "./screens/Rating";
import Learn from "./screens/Learn";
import Profile, { Settings, Achievements } from "./screens/Profile";
import Quiz from "./screens/Quiz";
import Intro from "./screens/Intro";
import Pay from "./screens/Pay";
import { Lessons, LessonView } from "./screens/Lessons";
import Balance from "./screens/Balance";
import Duel from "./screens/Duel";
import FinalLive from "./screens/FinalLive";
import Share from "./screens/Share";
import { CertView, Verify } from "./screens/Cert";
import { Admin, Report } from "./screens/Admin";
import { AdminLogin, Super } from "./screens/Super";
import TestTaker from "./screens/TestTaker";
import { WqAnswer, WqSubmit } from "./screens/WeekQ";
import WeekEnd from "./screens/WeekEnd";
import Topics from "./screens/Topics";
import { TaxCalendar, News, NewsView, Calcs, TestReport } from "./screens/Tools";
import Review from "./screens/Review";

const SCREENS: Record<string, (p: any) => JSX.Element | null> = {
  home: Home, rate: Rating, learn: Learn, profile: Profile, settings: Settings, ach: Achievements, quiz: Quiz, intro: Intro, pay: Pay,
  lessons: Lessons, lesson: LessonView, balance: Balance, duel: Duel, finalLive: FinalLive, share: Share, cert: CertView,
  admin: Admin, report: Report, adminLogin: AdminLogin, super: Super, wqAnswer: WqAnswer, wqSubmit: WqSubmit, weekEnd: WeekEnd,
  topics: Topics, region: () => <AskRegion back />,
  calendar: TaxCalendar, news: News, newsView: NewsView, calc: Calcs, testReport: TestReport, review: Review,
};
const NAVS: [string, any, string][] = [["home", HomeI, "Asosiy"], ["rate", Trophy, "Reyting"], ["learn", BookOpen, "O'qish"], ["profile", User, "Profil"]];

export default function App() {
  useStore();
  const { route, toast } = useNav();
  let body: JSX.Element;
  if (entry.v) body = <Verify id={entry.v} />;                      // sertifikat tekshiruvi — ro'yxatsiz
  else if (entry.t && !S.adminPin) body = <TestTaker code={entry.t} />; // xodim testi — ro'yxatsiz
  else if (S.tgTry) body = <div className="shell bare"><div className="splash"><span className="spinner" />{t("Yuklanmoqda...")}</div></div>;
  else if (!S.lang) body = <LangPick />;
  else if (!S.user.first) body = <Register />;
  else if (!S.user.region) body = <AskRegion />;
  else {
    const Scr = SCREENS[route.name] || Home;
    body = (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={route.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          <Scr {...(route.p || {})} />
        </motion.div>
      </AnimatePresence>
    );
  }
  const showNav = S.lang && S.user.first && S.user.region && !entry.v && !(entry.t && !S.adminPin) && isTab(route.name);
  return (
    <>
      {body}
      {showNav && (
        <nav className="nav" aria-label={t("Menyu")}>
          <div className="nav-in">
            {NAVS.map(([id, Ic, label]) => (
              <button key={id} className={route.name === id ? "on" : ""} onClick={() => tab(id)} aria-current={route.name === id ? "page" : undefined}>
                {route.name === id && <motion.i layoutId="navpill" className="pill" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                <span><Ic size={21} strokeWidth={2.2} />{t(label)}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
      <Toast toast={toast} />
    </>
  );
}
