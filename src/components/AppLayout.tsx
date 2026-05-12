import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Send, UserPlus, ShoppingBag, Info, Shield, Menu, X, Zap,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, color: "text-neon-cyan" },
  { to: "/forward", label: "Forward Post", icon: Send, color: "text-neon-purple" },
  { to: "/create-account", label: "Create Account", icon: UserPlus, color: "text-neon-green" },
  { to: "/store", label: "Buy Account", icon: ShoppingBag, color: "text-neon-pink" },
  { to: "/about", label: "About", icon: Info, color: "text-neon-cyan" },
  { to: "/admin", label: "Admin Panel", icon: Shield, color: "text-neon-purple" },
] as const;

const bottomNav = navItems.slice(0, 5);

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen scanline">
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => setOpen(true)}
          className="grid place-items-center w-10 h-10 rounded-lg border border-neon-cyan/40 text-neon-cyan hover:border-glow-cyan transition-shadow"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-neon-cyan text-glow-cyan" />
          <span className="font-display font-bold tracking-[0.2em] text-neon-cyan text-glow-cyan text-sm">
            AUTOFORWARD
          </span>
        </div>
      </header>

      {/* Sidebar */}
      <div
        className={`fixed inset-0 z-50 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 glass border-r border-neon-cyan/20 p-5 flex flex-col gap-1 transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="grid place-items-center w-10 h-10 rounded-lg border border-neon-cyan text-neon-cyan border-glow-cyan">
                <Zap className="w-5 h-5" />
              </div>
              <span className="font-display font-bold tracking-[0.2em] text-neon-cyan text-glow-cyan">
                AUTOFORWARD
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-1 mt-2">
            {navItems.map((item) => {
              const active = path === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center gap-3 px-3 py-3 rounded-lg border transition-all ${
                    active
                      ? `border-current ${item.color} bg-white/5`
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? item.color : ""}`} />
                  <span className="font-medium tracking-wide">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-neon-cyan/40 p-3">
              <div className="text-[10px] tracking-[0.2em] text-muted-foreground">FREE TRIAL</div>
              <div className="font-display font-bold text-neon-cyan text-glow-cyan">FREE TRIAL READY</div>
            </div>
            <a
              href="https://t.me/digital_market1199"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-neon-purple/50 px-3 py-2 text-neon-purple hover:border-glow-purple transition-shadow"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm">@digital_market1199</span>
            </a>
          </div>
        </aside>
      </div>

      {/* Page */}
      <main className="px-4 pt-4 pb-28 max-w-screen-md mx-auto">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 glass border-t border-neon-cyan/20">
        <ul className="grid grid-cols-5 max-w-screen-md mx-auto">
          {bottomNav.map((item) => {
            const active = path === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] tracking-wider ${
                    active ? `${item.color} text-glow-cyan` : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="uppercase">{item.label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
