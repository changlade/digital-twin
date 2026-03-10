import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Lightbulb, Briefcase, Activity, Zap, Leaf, FlaskConical, GitFork, Play } from "lucide-react";
import { useTour } from "./TourContext";
import { tourSteps } from "./tourSteps";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 10;

export default function TourOverlay() {
  const { isActive, stepIndex, totalSteps, next, prev, stop } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const step = tourSteps[stepIndex];

  // Spotlight: find the element, scroll it into view, measure its rect.
  // The card position is NOT derived from this — the card is always fixed bottom-right.
  useEffect(() => {
    if (!isActive || !step) return;
    setSpotlight(null);

    const measure = (el: HTMLElement, retries = 4) => {
      el.scrollIntoView({ block: "center" });
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          if (retries > 0) measure(el, retries - 1);
          // If still zero after retries, leave spotlight as null (no highlight box)
          return;
        }
        setSpotlight({
          top: r.top - SPOTLIGHT_PADDING,
          left: r.left - SPOTLIGHT_PADDING,
          width: r.width + SPOTLIGHT_PADDING * 2,
          height: r.height + SPOTLIGHT_PADDING * 2,
        });
      }, 320);
    };

    const tryFind = (attemptsLeft: number) => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
      if (el) {
        measure(el);
      } else if (attemptsLeft > 0) {
        setTimeout(() => tryFind(attemptsLeft - 1), 200);
      }
      // Element not found after retries → no spotlight, card still shows
    };

    const timer = setTimeout(() => tryFind(5), 350);
    return () => clearTimeout(timer);
  }, [isActive, stepIndex, step]);

  if (!isActive || !step) return null;

  return createPortal(
    <>
      {/* ── Dim overlay ────────────────────────────────────────────────────── */}

      {/* Intro: plain full-screen dim (no spotlight cutout) */}
      {step.id === "intro" && (
        <div className="fixed inset-0 z-[9998] bg-black/55 pointer-events-none" />
      )}

      {/* Feature steps: spotlight cutout via box-shadow */}
      {spotlight && step.id !== "intro" && (
        <div
          className="fixed inset-0 z-[9998] pointer-events-none"
          style={{ isolation: "isolate" }}
        >
          <div
            className="absolute rounded-xl transition-all duration-300"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.50)",
              border: "2px solid rgba(0,158,224,0.9)",
              outline: "4px solid rgba(0,158,224,0.15)",
            }}
          />
        </div>
      )}

      {/* ── Tour card — always fixed bottom-right, never moves ─────────────── */}
      <div
        className="fixed z-[9999] pointer-events-auto"
        style={{ bottom: 28, right: 28, width: step.id === "intro" ? 520 : 420 }}
      >
        {step.id === "intro" ? (
          /* ── Intro / exec-summary card ─────────────────────────────────── */
          <div className="rounded-xl border border-danone-blue/30 bg-danone-gray-900/98 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Brand header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-danone-gray-700 bg-danone-blue/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-danone-blue flex items-center justify-center shadow-lg">
                  <Activity size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-none">DairyFlow</p>
                  <p className="text-xs text-danone-lightblue mt-0.5">Bio-Mechanical Digital Twin · Powered by Databricks</p>
                </div>
              </div>
              <button
                onClick={stop}
                className="w-6 h-6 rounded-md flex items-center justify-center text-danone-gray-400 hover:text-white hover:bg-danone-gray-700 transition-colors"
                aria-label="Close tour"
              >
                <X size={13} />
              </button>
            </div>

            {/* Summary body */}
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-danone-gray-300 leading-relaxed">
                Raw milk variability — fat %, protein %, viscosity — directly drives equipment energy consumption, product quality, and carbon footprint. Today those two worlds are tracked in separate systems, creating costly blind spots. <span className="text-white font-medium">DairyFlow fuses them into one live operational view.</span>
              </p>

              {/* 4 capability blocks */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-danone-gray-500 uppercase tracking-wide">4 capabilities, one platform</p>
                <div className="space-y-1.5">
                  {[
                    {
                      icon: <Zap size={14} />,
                      label: "Live Operations Dashboard",
                      detail: "1-second sensor stream · 5 KPIs · equipment alarms · batch quality — all auto-refreshed from Databricks gold tables",
                      color: "text-yellow-400 bg-yellow-400/8 border-yellow-400/20",
                    },
                    {
                      icon: <GitFork size={14} />,
                      label: "Bio-Mechanical Knowledge Graph",
                      detail: "Interactive graph linking milk batches to factory equipment via live 'processed_by' edges — trace quality issues to root cause in seconds",
                      color: "text-danone-lightblue bg-danone-blue/8 border-danone-blue/20",
                    },
                    {
                      icon: <Leaf size={14} />,
                      label: "Sustainability Hub",
                      detail: "Per-batch CO₂ traceback, energy intensity vs. target, and water consumption — with automated insight on which batch is worst and why",
                      color: "text-emerald-400 bg-emerald-400/8 border-emerald-400/20",
                    },
                    {
                      icon: <FlaskConical size={14} />,
                      label: "What-If Simulation Engine",
                      detail: "Adjust fat %, protein %, and pasteurizer temperature against real batch data — instantly see energy, quality, and CO₂ trade-offs before touching the floor",
                      color: "text-purple-400 bg-purple-400/8 border-purple-400/20",
                    },
                  ].map(({ icon, label, detail, color }) => (
                    <div key={label} className={`flex gap-3 px-3 py-2.5 rounded-lg border ${color}`}>
                      <span className="mt-0.5 shrink-0">{icon}</span>
                      <div>
                        <p className="text-xs font-semibold leading-snug mb-0.5">{label}</p>
                        <p className="text-xs text-danone-gray-400 leading-relaxed">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exec value line */}
              <div className="flex items-start gap-2.5 bg-danone-blue/10 border border-danone-blue/20 rounded-lg px-3 py-3">
                <Briefcase size={14} className="text-danone-lightblue mt-0.5 shrink-0" />
                <p className="text-sm text-danone-gray-300 leading-relaxed italic">
                  "Reduce unplanned downtime, improve First Time Right, lower energy cost, and hit sustainability targets — without waiting for a shift report."
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-danone-gray-700 bg-danone-gray-800/50">
              <p className="text-xs text-danone-gray-500">
                {totalSteps - 1} features to explore · Esc to exit
              </p>
              <button
                onClick={next}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-danone-blue hover:bg-danone-blue/80 px-4 py-2 rounded-lg transition-colors"
              >
                <Play size={14} />
                Start Tour
              </button>
            </div>
          </div>
        ) : (
          /* ── Regular step card ──────────────────────────────────────────── */
          <div className="rounded-xl border border-danone-gray-600 bg-danone-gray-900/98 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-danone-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-danone-lightblue bg-danone-blue/15 border border-danone-blue/25 rounded-full px-2 py-0.5">
                  {stepIndex} / {totalSteps - 1}
                </span>
                <span className="text-xs text-danone-gray-500 font-mono">
                  {step.route === "/"
                    ? "Dashboard"
                    : step.route === "/graph"
                    ? "Bio-Mech Graph"
                    : step.route === "/sustainability"
                    ? "Sustainability"
                    : "What-If Sim"}
                </span>
              </div>
              <button
                onClick={stop}
                className="w-6 h-6 rounded-md flex items-center justify-center text-danone-gray-400 hover:text-white hover:bg-danone-gray-700 transition-colors"
                aria-label="Close tour"
              >
                <X size={13} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-3">
              <h3 className="text-base font-bold text-white leading-snug">{step.title}</h3>
              <p className="text-sm text-danone-gray-300 leading-relaxed">{step.description}</p>

              {/* Business focus callout */}
              <div className="flex items-start gap-2.5 bg-danone-blue/10 border border-danone-blue/20 rounded-lg px-3 py-2.5">
                <Briefcase size={14} className="text-danone-lightblue mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-danone-lightblue mb-0.5 uppercase tracking-wide">
                    Business question answered
                  </p>
                  <p className="text-sm text-danone-gray-300 leading-relaxed italic">
                    "{step.businessFocus}"
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-1">
              <div className="h-0.5 bg-danone-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-danone-lightblue rounded-full transition-all duration-300"
                  style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={prev}
                className="flex items-center gap-1.5 text-sm text-danone-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-danone-gray-700"
              >
                <ChevronLeft size={15} />
                Back
              </button>

              <button
                onClick={stop}
                className="text-xs text-danone-gray-500 hover:text-danone-gray-300 transition-colors"
              >
                End Tour
              </button>

              {stepIndex < totalSteps - 1 ? (
                <button
                  onClick={next}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-danone-blue hover:bg-danone-blue/80 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Lightbulb size={14} />
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
