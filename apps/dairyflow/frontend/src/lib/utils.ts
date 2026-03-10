import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toNum(n: unknown): number | null {
  if (n == null) return null;
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  return isFinite(v) ? v : null;
}

export function fmt(n: unknown, decimals = 1): string {
  const v = toNum(n);
  if (v == null) return "—";
  return v.toFixed(decimals);
}

export function fmtPct(n: unknown): string {
  const v = toNum(n);
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

export function fmtKwh(n: unknown): string {
  const v = toNum(n);
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)} MWh`;
  return `${v.toFixed(1)} kWh`;
}

export function statusColor(status: "ok" | "warning" | "alarm"): string {
  return {
    ok: "text-emerald-400",
    warning: "text-yellow-400",
    alarm: "text-red-400",
  }[status];
}

export function statusBg(status: "ok" | "warning" | "alarm"): string {
  return {
    ok: "bg-emerald-400/10 border-emerald-400/30",
    warning: "bg-yellow-400/10 border-yellow-400/30",
    alarm: "bg-red-400/10 border-red-400/30",
  }[status];
}

export function equipmentTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    Centrifuge: "⚙",
    Pasteurizer: "🔥",
    SprayDryer: "💨",
    MixingTank: "🌀",
    CIPUnit: "💧",
  };
  return icons[type] ?? "📦";
}

export function equipmentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    Centrifuge: "#6366F1",
    Pasteurizer: "#F97316",
    SprayDryer: "#06B6D4",
    MixingTank: "#8B5CF6",
    CIPUnit: "#3B82F6",
  };
  return colors[type] ?? "#64748B";
}
