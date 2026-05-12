import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Info, ShieldCheck, Zap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-neon-cyan text-glow-cyan">ABOUT & SAFETY</h1>
        <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">How autoforward works</p>
      </header>

      <section className="neon-card text-neon-cyan p-5 mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-neon-cyan" />
          <h2 className="font-display tracking-[0.15em] text-neon-cyan">WHAT IT DOES</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          AutoForward operates encrypted Telegram userbot sessions on your behalf. Configure a source channel, pick a target,
          set filters and delay — your bots will mirror messages 24/7 with smart spam-avoidance logic.
        </p>
      </section>

      <section className="neon-card text-neon-purple p-5 mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-neon-purple" />
          <h2 className="font-display tracking-[0.15em] text-neon-purple">HOW IT WORKS</h2>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Authorize a userbot with phone + OTP to generate a string session.</li>
          <li>Pick or buy additional accounts from the store to scale.</li>
          <li>Create a campaign linking source → target channels.</li>
          <li>Tune filters and delays, then launch in non-stop loop mode.</li>
        </ol>
      </section>

      <section className="rounded-xl border-2 border-destructive bg-destructive/10 p-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 30px oklch(0.65 0.25 25 / 30%)" }} />
        <div className="relative flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display tracking-[0.15em] text-destructive">SAFETY WARNING</h2>
            <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
              <strong className="text-destructive">Never use your official, business, or primary Telegram account</strong> with this tool.
              Always use secondary or spare accounts. Aggressive forwarding can trigger Telegram's anti-spam systems and result in
              permanent restrictions or bans. You are solely responsible for compliance with Telegram's Terms of Service.
            </p>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Info className="w-3 h-3" /> AutoForward v3.0 · Cyber Edition
      </p>
    </AppLayout>
  );
}
