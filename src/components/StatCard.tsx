import type { LucideIcon } from "lucide-react";

type Color = "cyan" | "purple" | "green" | "pink" | "red";

const colorMap: Record<Color, { text: string; border: string; shadow: string }> = {
  cyan: { text: "text-neon-cyan", border: "border-neon-cyan/40", shadow: "hover:border-glow-cyan" },
  purple: { text: "text-neon-purple", border: "border-neon-purple/40", shadow: "hover:border-glow-purple" },
  green: { text: "text-neon-green", border: "border-neon-green/40", shadow: "hover:border-glow-green" },
  pink: { text: "text-neon-pink", border: "border-neon-pink/40", shadow: "hover:border-glow-pink" },
  red: { text: "text-neon-red", border: "border-destructive/50", shadow: "" },
};

export function StatCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | number; sub: string; icon: LucideIcon; color: Color }) {
  const c = colorMap[color];
  return (
    <div className={`relative neon-card ${c.text} ${c.shadow} transition-shadow p-4`}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground leading-tight">
          {label}
        </div>
        <div className={`grid place-items-center w-9 h-9 rounded-lg border ${c.border} ${c.text}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`mt-4 font-display text-4xl font-bold ${c.text} text-glow-cyan`} style={{ textShadow: `0 0 12px currentColor` }}>
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
