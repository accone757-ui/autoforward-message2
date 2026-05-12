import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Smartphone, ShoppingBag, Ban, Activity, Zap, Link2, Hash,
  Copy, Check, ArrowRight, Loader2, AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { resolveTelegramChat } from "@/lib/telegram.functions";
import { getDashboardStats, checkDbReady } from "@/lib/db.functions";
import { parseInput, type Parsed } from "@/lib/telegram-parse";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [stats, dbStatus] = await Promise.allSettled([
      getDashboardStats(),
      checkDbReady(),
    ]);
    return {
      stats: stats.status === "fulfilled" ? stats.value : null,
      dbReady: dbStatus.status === "fulfilled" ? dbStatus.value.ready : false,
    };
  },
  component: Dashboard,
});

function Dashboard() {
  const { stats, dbReady } = Route.useLoaderData();
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{
    id: string;
    type: string;
    title: string | null;
    username: string;
  } | null>(null);

  const parsed = useMemo(() => parseInput(input), [input]);
  const resolveFn = useServerFn(resolveTelegramChat);

  const copy = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const onResolve = async () => {
    setError(null);
    setResolved(null);
    if (parsed.kind === "numeric") {
      setResolved({ id: parsed.numericId!, type: "numeric", title: null, username: "" });
      return;
    }
    if (parsed.kind === "private") {
      setError("Private invite links cannot be resolved — the bot must join the chat first.");
      return;
    }
    if (!parsed.username) {
      setError("Enter a public @username, t.me link, or numeric ID.");
      return;
    }
    setLoading(true);
    try {
      const res = await resolveFn({ data: { username: parsed.username } });
      if (!res.ok) {
        setError(res.error);
      } else {
        setResolved({ id: res.id, type: res.type, title: res.title, username: res.username });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setLoading(false);
    }
  };

  const kindLabel: Record<Parsed["kind"], string> = {
    public: "Public Channel / Group",
    private: "Private Invite Link",
    username: "Username",
    numeric: "Numeric ID",
    unknown: "—",
  };

  const rows: { label: string; value?: string }[] = [
    { label: "Type", value: input ? (resolved?.type ? resolved.type : kindLabel[parsed.kind]) : undefined },
    { label: "Title", value: resolved?.title ?? undefined },
    { label: "Username", value: resolved?.username ? `@${resolved.username}` : (parsed.username ? `@${parsed.username}` : undefined) },
    { label: "Public Link", value: parsed.publicLink },
    { label: "Invite Hash", value: parsed.inviteHash },
    { label: "Real ID", value: resolved?.id },
  ];

  return (
    <AppLayout>
      {!dbReady && (
        <div className="mb-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-yellow-400 tracking-wide">DATABASE NOT CONFIGURED</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Run the SQL migration in your{" "}
              <a
                href="https://supabase.com/dashboard/project/vdkbetuwgozvbkzelmur/sql/new"
                target="_blank"
                rel="noreferrer"
                className="underline text-yellow-400"
              >
                Supabase SQL editor
              </a>
              . The migration file is at <span className="font-mono">supabase/migration.sql</span>.
            </p>
          </div>
        </div>
      )}

      <section className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-7 h-7 text-neon-cyan text-glow-cyan" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-neon-cyan text-glow-cyan">
              DASHBOARD
            </h1>
          </div>
          <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Autoforward message — system overview
          </p>
        </div>
        <div className="neon-card text-neon-green border-neon-green/40 animate-pulse-glow p-3 min-w-[140px] text-right">
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Free Trial</div>
          <div className="font-display font-bold text-neon-green text-glow-green leading-tight mt-1">
            READY
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Starts on first campaign</div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Self-Created Active"
          value={stats?.selfCreatedActive ?? 0}
          sub={`of ${stats?.selfCreatedTotal ?? 0} total`}
          icon={Smartphone}
          color="cyan"
        />
        <StatCard
          label="Purchased Active"
          value={stats?.purchasedActive ?? 0}
          sub={`of ${stats?.purchasedTotal ?? 0} total`}
          icon={ShoppingBag}
          color="purple"
        />
        <StatCard
          label="Messages Sent"
          value={stats?.messagesSent ?? 0}
          sub={`${stats?.messagesFailed ?? 0} failed`}
          icon={Activity}
          color="green"
        />
        <StatCard
          label="Spam / Banned"
          value={stats?.spamBanned ?? 0}
          sub={`${stats?.spamRestricted ?? 0} restricted`}
          icon={Ban}
          color="red"
        />
      </section>

      <section className="neon-card text-neon-purple p-4">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="w-4 h-4 text-neon-purple" />
          <h2 className="font-display tracking-[0.2em] text-sm text-neon-purple text-glow-purple">
            LINK → REAL ID CONVERTER
          </h2>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
            <Link2 className="w-3 h-3 text-neon-cyan" /> Channel link, group link, @username, or numeric ID
          </label>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); setResolved(null); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") onResolve(); }}
              placeholder="https://t.me/channel · @username · -1001234567890"
              className="flex-1 bg-input/60 border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-neon-purple focus:border-glow-purple"
            />
            <button
              onClick={onResolve}
              disabled={loading || !input.trim()}
              className="grid place-items-center h-10 w-10 rounded-lg border border-neon-purple/60 text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-40 shrink-0"
              aria-label="Resolve"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-neon-red/40 bg-neon-red/10 px-3 py-2 text-xs text-neon-red">
            {error}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-border bg-black/50 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground shrink-0">
                {r.label}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-mono text-xs truncate ${r.value ? "text-neon-cyan" : "text-muted-foreground/50"}`}>
                  {r.value ?? "—"}
                </span>
                {r.value && (
                  <button
                    onClick={() => copy(r.label, r.value!)}
                    className="grid place-items-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-neon-purple hover:border-neon-purple/60 transition-colors shrink-0"
                    aria-label={`Copy ${r.label}`}
                  >
                    {copied === r.label ? (
                      <Check className="w-3.5 h-3.5 text-neon-green" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
          Paste a public @username or t.me link and press the arrow — the converter calls Telegram's{" "}
          <span className="font-mono text-neon-purple">getChat</span> through your connected bot to return the real
          ID. Numeric IDs are normalized to Bot API format (<span className="font-mono text-neon-purple">-100…</span>).
          Private invite links can't be resolved unless the bot has joined the chat.
        </p>
      </section>
    </AppLayout>
  );
}
