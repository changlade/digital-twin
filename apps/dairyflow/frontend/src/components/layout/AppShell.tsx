import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, GitFork, Leaf, FlaskConical, Activity, Play } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTour } from "../tour/TourContext";
import TourOverlay from "../tour/TourOverlay";
import NotificationBell from "../notifications/NotificationBell";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { to: "/", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
  { to: "/graph", icon: <GitFork size={18} />, label: "Bio-Mech Graph" },
  { to: "/sustainability", icon: <Leaf size={18} />, label: "Sustainability" },
  { to: "/simulator", icon: <FlaskConical size={18} />, label: "What-If Sim" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { start, isActive } = useTour();

  return (
    <div className="flex h-full bg-danone-gray-900">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="flex flex-col w-[220px] shrink-0 border-r border-danone-gray-700 bg-danone-gray-900">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-danone-gray-700">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-danone-blue">
            <Activity size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-none truncate">DairyFlow</p>
            <p className="text-[10px] text-danone-gray-400 mt-0.5 truncate">Bio-Mech Optimizer</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="section-title px-2">Navigation</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-danone-blue/15 text-white border border-danone-blue/30"
                    : "text-danone-gray-400 hover:bg-danone-gray-700 hover:text-white"
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-danone-gray-700 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-danone-lightblue" />
              <span className="text-[10px] text-danone-gray-500 font-mono">
                fevm-danonedemo
              </span>
            </div>
            <p className="text-[10px] text-danone-gray-600 mt-0.5 font-mono truncate">
              danonedemo_catalog.digital_twin
            </p>
          </div>

          {/* Start Demo button */}
          <button
            onClick={start}
            disabled={isActive}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
              isActive
                ? "border-danone-blue/40 bg-danone-blue/10 text-danone-lightblue cursor-not-allowed"
                : "border-danone-gray-600 text-danone-gray-400 hover:text-white hover:border-danone-gray-500 hover:bg-danone-gray-700"
            )}
          >
            <Play size={11} className={isActive ? "animate-pulse" : ""} />
            {isActive ? "Demo running…" : "Start Demo"}
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-danone-gray-700 bg-danone-gray-900 shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">
              {navItems.find((n) =>
                n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)
              )?.label ?? "Danone DairyFlow"}
            </h1>
            <p className="text-[11px] text-danone-gray-500 mt-0.5">
              Production &amp; Sustainability Intelligence Hub
            </p>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            {/* Danone wordmark */}
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-danone-blue flex items-center justify-center">
                <span className="text-[9px] font-black text-white leading-none">D</span>
              </div>
              <span className="text-xs font-bold text-danone-gray-300 tracking-wide">DANONE</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>

      <TourOverlay />
    </div>
  );
}
