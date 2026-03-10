import { cn } from "../lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accent?: "blue" | "green" | "yellow" | "red" | "purple" | "cyan";
  loading?: boolean;
}

const accentMap = {
  blue:   { icon: "bg-danone-blue/20 text-danone-lightblue", border: "border-danone-blue/20" },
  green:  { icon: "bg-emerald-500/15 text-emerald-400",      border: "border-emerald-500/20" },
  yellow: { icon: "bg-yellow-500/15 text-yellow-400",         border: "border-yellow-500/20" },
  red:    { icon: "bg-red-500/15 text-red-400",               border: "border-red-500/20" },
  purple: { icon: "bg-purple-500/15 text-purple-400",         border: "border-purple-500/20" },
  cyan:   { icon: "bg-cyan-500/15 text-cyan-400",             border: "border-cyan-500/20" },
};

export default function KpiCard({
  label,
  value,
  sub,
  icon,
  trend,
  accent = "blue",
  loading = false,
}: KpiCardProps) {
  const colors = accentMap[accent];

  return (
    <div className={cn("card flex flex-col gap-3 min-w-0", colors.border)}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0", colors.icon)}>
          {icon}
        </div>
      </div>

      {loading ? (
        <div className="h-7 w-24 bg-danone-gray-700 rounded animate-pulse" />
      ) : (
        <p className="stat-value truncate">{value}</p>
      )}

      {sub && (
        <p className={cn(
          "text-xs font-medium",
          trend === "up"   ? "text-emerald-400" :
          trend === "down" ? "text-red-400" :
                             "text-danone-gray-500"
        )}>
          {trend === "up" && "▲ "}
          {trend === "down" && "▼ "}
          {sub}
        </p>
      )}
    </div>
  );
}
