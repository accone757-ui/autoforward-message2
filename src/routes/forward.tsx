import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Send, Link2, Filter, Ban, Scissors, Repeat, Play, Square, Activity,
  Plus, Trash2, Tag, Loader2, CheckCircle2, AlertTriangle, Megaphone,
  User, LinkIcon, Database,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { resolveTelegramChat, preflightCheckChat } from "@/lib/telegram.functions";
import { parseInput } from "@/lib/telegram-parse";
import { getAccounts, saveCampaign, incrementCampaignMessages } from "@/lib/db.functions";
import { runForwardCampaign } from "@/lib/forward.functions";
import type { Account } from "@/lib/supabase";

export const Route = createFileRoute("/forward")({
  loader: async () => {
    const accounts = await getAccounts().catch(() => [] as Account[]);
    return { accounts: accounts as Account[] };
  },
  component: ForwardPage,
});

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full border transition-all ${
        checked ? "bg-neon-cyan/20 border-neon-cyan border-glow-cyan" : "bg-secondary border-border"
      }`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
        checked ? "left-6 bg-neon-cyan shadow-[0_0_10px_currentColor]" : "left-0.5 bg-muted-foreground"
      }`} />
    </button>
  );
}

function ForwardPage() {
  const { accounts } = Route.useLoaderData();

  const [filters, setFilters] = useState({ text: true, blacklist: false, links: true, forwardName: true });
  const [loop, setLoop] = useState(true);
  const [delay, setDelay] = useState(30);
  const [running, setRunning] = useState(false);
  const [sent, setSent] = useState(0);
  const [failed, setFailed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [campaignLog, setCampaignLog] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([""]);
  const [sourceMode, setSourceMode] = useState<"channel" | "chat" | "link">("channel");
  const [targets, setTargets] = useState<string[]>([""]);
  const [batchSize, setBatchSize] = useState(5);
  const [batchDelay, setBatchDelay] = useState(10);
  const [loopDelay, setLoopDelay] = useState(15);
  const [messageLimit, setMessageLimit] = useState(10);
  const [resolving, setResolving] = useState(false);
  const [resolvedTargets, setResolvedTargets] = useState<Array<{ input: string; id?: string; title?: string | null; error?: string }>>([]);
  const [resolvedSources, setResolvedSources] = useState<Array<{ input: string; id?: string; title?: string | null; error?: string }>>([]);
  const [preflight, setPreflight] = useState<Array<{ input: string; role: "source" | "target"; ok: boolean; message: string; needsJoin?: boolean; botUsername?: string | null }>>([]);
  const [sourceErrors, setSourceErrors] = useState<Array<{ input: string; error: string }>>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const startedAt = useRef<number | null>(null);
  const loopRef = useRef<boolean>(true);
  const runningRef = useRef<boolean>(false);

  const resolveFn = useServerFn(resolveTelegramChat);
  const preflightFn = useServerFn(preflightCheckChat);
  const getAccountsFn = useServerFn(getAccounts);
  const saveCampaignFn = useServerFn(saveCampaign);
  const incrementFn = useServerFn(incrementCampaignMessages);
  const runForwardFn = useServerFn(runForwardCampaign);

  const activeAccounts = (accounts as Account[]).filter((a) => a.status === "active" && a.session_string);

  useEffect(() => {
    if (activeAccounts.length > 0 && !selectedAccount) {
      setSelectedAccount(activeAccounts[0].id);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now() - elapsed * 1000;
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  const log = (msg: string) => {
    setCampaignLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const extractLinkChannel = (raw: string): { input: string; channel?: string; numericId?: string; error?: string } => {
    const s = raw.trim().replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
    const m = s.match(/^(c\/(\d+)|([A-Za-z][A-Za-z0-9_]{3,31}))\/(\d+)/);
    if (!m) return { input: raw, error: "Invalid message link." };
    if (m[2]) return { input: raw, numericId: `-100${m[2]}` };
    return { input: raw, channel: m[3] };
  };

  const resolveOne = async (raw: string, isLink = false): Promise<{ input: string; id?: string; title?: string | null; error?: string }> => {
    if (isLink) {
      const ex = extractLinkChannel(raw);
      if (ex.error) return { input: raw, error: ex.error };
      if (ex.numericId) return { input: raw, id: ex.numericId };
      try {
        const res = await resolveFn({ data: { username: ex.channel! } });
        if (res.ok) return { input: raw, id: res.id, title: res.title };
        return { input: raw, error: res.error };
      } catch (e) {
        return { input: raw, error: e instanceof Error ? e.message : "Resolve failed" };
      }
    }
    const p = parseInput(raw);
    if (p.kind === "numeric") return { input: raw, id: p.numericId };
    if (p.kind === "private") return { input: raw, error: "Private invite link — bot must join first." };
    if (p.username) {
      try {
        const res = await resolveFn({ data: { username: p.username } });
        if (res.ok) return { input: raw, id: res.id, title: res.title };
        return { input: raw, error: res.error };
      } catch (e) {
        return { input: raw, error: e instanceof Error ? e.message : "Resolve failed" };
      }
    }
    return { input: raw, error: "Invalid input." };
  };

  const resolveAllTargets = async () => Promise.all(targets.map((t) => t.trim()).filter(Boolean).map((r) => resolveOne(r, false)));
  const resolveAllSources = async () => Promise.all(sources.map((t) => t.trim()).filter(Boolean).map((r) => resolveOne(r, sourceMode === "link")));

  const validateSource = (raw: string): string | null => {
    const v = raw.trim();
    if (!v) return "Empty source.";
    const p = parseInput(v);
    if (sourceMode === "channel") {
      if (p.kind === "private") return "Private invite link — bot must join the channel first.";
      if (p.kind === "username" || p.kind === "public" || p.kind === "numeric") return null;
      return "Enter @username, t.me/<channel>, or numeric channel ID.";
    }
    if (sourceMode === "chat") {
      if (p.kind === "numeric" || p.kind === "username" || p.kind === "public") return null;
      return "Enter @username or numeric chat ID for a personal chat.";
    }
    const s = v.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");
    const m = s.match(/^(c\/\d+|[A-Za-z][A-Za-z0-9_]{3,31})\/(\d+)(?:[/?#].*)?$/);
    if (!m) return "Enter a message link like https://t.me/<channel>/<message_id>.";
    return null;
  };

  const runPreflight = async (items: Array<{ input: string; id?: string; error?: string }>, role: "source" | "target") => {
    return Promise.all(items.map(async (it) => {
      if (it.error || !it.id) return { input: it.input, role, ok: false, message: it.error ?? "Unresolved" };
      try {
        const r = await preflightFn({ data: { chatId: it.id, role } });
        if (r.ok) return { input: it.input, role, ok: true, message: `${r.chatType}${r.title ? ` · ${r.title}` : ""} (status: ${r.status})`, botUsername: r.botUsername };
        return { input: it.input, role, ok: false, message: r.error, needsJoin: r.needsJoin, botUsername: r.botUsername };
      } catch (e) {
        return { input: it.input, role, ok: false, message: e instanceof Error ? e.message : "Preflight failed" };
      }
    }));
  };

  const runOneCycle = async (
    account: Account,
    srcIds: string[],
    tgtIds: string[],
  ) => {
    for (const srcId of srcIds) {
      if (!runningRef.current) break;
      log(`Forwarding from ${srcId} → ${tgtIds.length} target(s)…`);
      try {
        const result = await runForwardFn({
          data: {
            sessionString: account.session_string!,
            apiId: parseInt(process.env.TELEGRAM_API_ID ?? "0"),
            apiHash: process.env.TELEGRAM_API_HASH ?? "",
            fromChatId: srcId,
            toChatIds: tgtIds,
            messageLimit,
            delaySecs: batchDelay,
            removeLinks: filters.links,
            forwardName: filters.forwardName,
          },
        });
        if (result.ok) {
          setSent((n) => n + result.forwarded);
          setFailed((n) => n + result.failed);
          if (campaignId) await incrementFn({ data: { id: campaignId, count: result.forwarded } }).catch(() => {});
          log(`✓ Forwarded ${result.forwarded} messages${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
          if (result.errors.length > 0) result.errors.forEach((e) => log(`✗ ${e}`));
        } else {
          log(`✗ Campaign error: ${result.errors[0] ?? "Unknown"}`);
          setFailed((n) => n + 1);
        }
      } catch (e) {
        log(`✗ Error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
      if (delay > 0 && runningRef.current) {
        log(`Waiting ${delay}s before next forward…`);
        await new Promise((r) => setTimeout(r, delay * 1000));
      }
    }
  };

  const start = async () => {
    setGlobalError(null);
    const account = (accounts as Account[]).find((a) => a.id === selectedAccount);
    if (!account || !account.session_string) {
      setGlobalError("No active account with session selected. Create an account first.");
      return;
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID ?? "0");
    const apiHash = process.env.TELEGRAM_API_HASH ?? "";
    if (!apiId || !apiHash) {
      setGlobalError("TELEGRAM_API_ID and TELEGRAM_API_HASH are required. Set them in environment variables.");
      return;
    }

    const sourceList = sources.map((t) => t.trim()).filter(Boolean);
    const targetList = targets.map((t) => t.trim()).filter(Boolean);
    const srcErrs = sourceList.map((s) => ({ input: s, error: validateSource(s) })).filter((r): r is { input: string; error: string } => r.error !== null);

    if (sourceList.length === 0) { setSourceErrors([{ input: "", error: "Add at least one source." }]); return; }
    if (targetList.length === 0) { setResolvedTargets([{ input: "", error: "Add at least one target channel." }]); return; }
    setSourceErrors(srcErrs);
    if (srcErrs.length > 0) return;

    setResolving(true);
    setResolvedSources([]);
    setResolvedTargets([]);
    setPreflight([]);
    setCampaignLog([]);

    const [srcResolved, tgtResolved] = await Promise.all([resolveAllSources(), resolveAllTargets()]);
    setResolvedSources(srcResolved);
    setResolvedTargets(tgtResolved);

    if (srcResolved.some((r) => r.error) || tgtResolved.some((r) => r.error)) {
      setResolving(false);
      return;
    }

    const [srcCheck, tgtCheck] = await Promise.all([runPreflight(srcResolved, "source"), runPreflight(tgtResolved, "target")]);
    const all = [...srcCheck, ...tgtCheck];
    setPreflight(all);
    setResolving(false);
    if (all.some((r) => !r.ok)) return;

    const srcIds = srcResolved.map((r) => r.id!);
    const tgtIds = tgtResolved.map((r) => r.id!);

    let cId: string | null = null;
    try {
      const campaign = await saveCampaignFn({
        data: {
          sources: sourceList,
          targets: targetList,
          filters,
          delay_secs: delay,
          loop,
          status: "running",
        },
      });
      cId = (campaign as { id: string }).id;
      setCampaignId(cId);
    } catch {}

    setSent(0); setFailed(0); setElapsed(0);
    runningRef.current = true;
    loopRef.current = loop;
    setRunning(true);
    log("Campaign started");

    const runLoop = async () => {
      do {
        await runOneCycle(account, srcIds, tgtIds);
        if (loopRef.current && runningRef.current) {
          log(`Loop complete. Waiting ${loopDelay}s before next loop…`);
          await new Promise((r) => setTimeout(r, loopDelay * 1000));
        }
      } while (loopRef.current && runningRef.current);

      runningRef.current = false;
      setRunning(false);
      log("Campaign stopped");
      if (cId) {
        saveCampaignFn({ data: { id: cId, sources: sourceList, targets: targetList, filters, delay_secs: delay, loop, status: "stopped" } }).catch(() => {});
      }
    };

    runLoop();
  };

  const stop = () => {
    runningRef.current = false;
    loopRef.current = false;
    setRunning(false);
    log("Stopping campaign…");
    if (campaignId) {
      const sourceList = sources.map((t) => t.trim()).filter(Boolean);
      const targetList = targets.map((t) => t.trim()).filter(Boolean);
      saveCampaignFn({ data: { id: campaignId, sources: sourceList, targets: targetList, filters, delay_secs: delay, loop, status: "stopped" } }).catch(() => {});
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-neon-purple text-glow-purple">FORWARD POST</h1>
        <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">Campaign setup</p>
      </header>

      {/* Account Selector */}
      <section className="neon-card text-neon-green p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-neon-green" />
          <h2 className="font-display tracking-[0.2em] text-sm text-neon-green">SELECT USERBOT ACCOUNT</h2>
        </div>
        {activeAccounts.length === 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            No active accounts with sessions found. Go to <strong>Create Account</strong> to authorize a userbot first.
          </div>
        ) : (
          <div className="space-y-2">
            {activeAccounts.map((a) => (
              <label key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedAccount === a.id ? "border-neon-green bg-neon-green/10" : "border-border hover:border-neon-green/40"
              }`}>
                <input
                  type="radio"
                  name="account"
                  value={a.id}
                  checked={selectedAccount === a.id}
                  onChange={() => setSelectedAccount(a.id)}
                  className="accent-neon-green"
                />
                <div>
                  <div className="text-sm font-mono text-foreground">{a.phone}</div>
                  <div className="text-[10px] text-muted-foreground">{a.type.replace("_", " ")} · {a.region}</div>
                </div>
                <span className="ml-auto text-[10px] text-neon-green border border-neon-green/40 px-2 py-0.5 rounded-full">active</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {globalError && (
        <div className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {globalError}
        </div>
      )}

      <section className="neon-card text-neon-purple p-4 space-y-5 mb-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-neon-purple" /> Source
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {([
              { key: "channel", label: "Channel Post", icon: Megaphone },
              { key: "chat", label: "Personal Chat", icon: User },
              { key: "link", label: "Message Link", icon: LinkIcon },
            ] as const).map((opt) => {
              const active = sourceMode === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSourceMode(opt.key)}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-md border text-[10px] tracking-wider uppercase transition-colors ${
                    active ? "bg-neon-purple/20 text-neon-purple border-neon-purple border-glow-purple" : "text-muted-foreground border-border hover:text-neon-purple"
                  }`}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                  <span className="leading-tight text-center">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <ChannelList
            label={sourceMode === "channel" ? "Source Channels" : sourceMode === "chat" ? "Source Personal Chats" : "Source Message Links"}
            icon={sourceMode === "channel" ? Megaphone : sourceMode === "chat" ? User : LinkIcon}
            values={sources}
            onChange={setSources}
            placeholder={sourceMode === "channel" ? "https://t.me/source_channel" : sourceMode === "chat" ? "@username or numeric chat ID" : "https://t.me/channel/12345"}
            accent="purple"
            batchSize={batchSize}
          />
        </div>
        <ChannelList
          label="Target Channels"
          icon={Send}
          values={targets}
          onChange={setTargets}
          placeholder="https://t.me/target_channel"
          accent="cyan"
          batchSize={batchSize}
        />

        {/* Message limit */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Messages Per Run</span>
            <div className="flex items-center gap-1.5">
              {[5, 10, 20, 50].map((n) => {
                const active = messageLimit === n;
                return (
                  <button key={n} onClick={() => setMessageLimit(n)}
                    className={`text-[11px] font-display tracking-wider px-2.5 py-1 rounded-md border transition-colors ${
                      active ? "bg-neon-purple/20 text-neon-purple border-neon-purple border-glow-purple" : "text-muted-foreground border-border hover:text-neon-purple"
                    }`}
                  >{n}</button>
                );
              })}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">How many latest messages to forward per campaign run.</p>
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Batch Threshold</span>
            <div className="flex items-center gap-1.5">
              {[3, 5, 10, 20].map((n) => {
                const active = batchSize === n;
                return (
                  <button key={n} onClick={() => setBatchSize(n)}
                    className={`text-[11px] font-display tracking-wider px-2.5 py-1 rounded-md border transition-colors ${
                      active ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan border-glow-cyan" : "text-muted-foreground border-border hover:text-neon-cyan"
                    }`}
                  >{n}</button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="neon-card text-neon-cyan p-4 mb-4">
        <h2 className="font-display tracking-[0.2em] text-sm text-neon-cyan mb-3">FILTERS</h2>
        <div className="space-y-3">
          {[
            { key: "text", label: "Text Filter", icon: Filter },
            { key: "blacklist", label: "Blacklist Words", icon: Ban },
            { key: "links", label: "Remove Links", icon: Scissors },
            { key: "forwardName", label: "Forward Name", icon: Tag },
          ].map((f) => (
            <div key={f.key} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <f.icon className="w-4 h-4 text-neon-cyan" /> {f.label}
              </span>
              <Toggle checked={filters[f.key as keyof typeof filters]} onChange={(v) => setFilters({ ...filters, [f.key]: v })} />
            </div>
          ))}
        </div>
      </section>

      <section className="neon-card text-neon-green p-4 mb-4">
        <h2 className="font-display tracking-[0.2em] text-sm text-neon-green mb-3">DELAY TIMER</h2>
        <div className="flex items-center gap-3">
          <input type="range" min={5} max={600} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="flex-1 accent-neon-green" />
          <div className="flex items-center gap-1">
            <input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))}
              className="w-20 bg-input/60 border border-border rounded-lg px-2 py-1.5 text-sm text-center" />
            <span className="text-xs text-muted-foreground">sec</span>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Delay Between Batches</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[0, 5, 10, 15, 30].map((n) => (
                <button key={n} onClick={() => setBatchDelay(n)}
                  className={`text-[11px] font-display tracking-wider px-2.5 py-1 rounded-md border transition-colors ${
                    batchDelay === n ? "bg-neon-green/20 text-neon-green border-neon-green border-glow-green" : "text-muted-foreground border-border hover:text-neon-green"
                  }`}
                >{n}s</button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <input type="number" min={0} value={batchDelay} onChange={(e) => setBatchDelay(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 bg-input/60 border border-border rounded-md px-2 py-1 text-xs text-center focus:outline-none focus:border-neon-green" />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Delay Between Loops</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[0, 5, 10, 15, 30].map((n) => (
                <button key={n} onClick={() => setLoopDelay(n)}
                  className={`text-[11px] font-display tracking-wider px-2.5 py-1 rounded-md border transition-colors ${
                    loopDelay === n ? "bg-neon-purple/20 text-neon-purple border-neon-purple border-glow-purple" : "text-muted-foreground border-border hover:text-neon-purple"
                  }`}
                >{n}s</button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <input type="number" min={0} value={loopDelay} onChange={(e) => setLoopDelay(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 bg-input/60 border border-border rounded-md px-2 py-1 text-xs text-center focus:outline-none focus:border-neon-purple" />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-2 text-sm">
            <Repeat className="w-4 h-4 text-neon-green" /> Non-stop Loop
          </span>
          <Toggle checked={loop} onChange={setLoop} />
        </div>
      </section>

      {running && (
        <section className="neon-card text-neon-green p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex w-2.5 h-2.5">
                <span className="absolute inset-0 rounded-full bg-neon-green animate-ping opacity-75" />
                <span className="relative rounded-full w-2.5 h-2.5 bg-neon-green" />
              </span>
              <span className="font-display tracking-[0.2em] text-sm text-neon-green text-glow-green">LIVE · CAMPAIGN RUNNING</span>
            </div>
            <Activity className="w-4 h-4 text-neon-green" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Sent</div>
              <div className="font-display text-2xl font-bold text-neon-green text-glow-green">{sent}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Uptime</div>
              <div className="font-display text-2xl font-bold text-neon-cyan text-glow-cyan font-mono">{fmt(elapsed)}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Failed</div>
              <div className={`font-display text-2xl font-bold ${failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>{failed}</div>
            </div>
          </div>
        </section>
      )}

      {/* Campaign Log */}
      {campaignLog.length > 0 && (
        <section className="neon-card text-neon-cyan p-4 mb-4">
          <h2 className="font-display tracking-[0.2em] text-sm text-neon-cyan mb-2">CAMPAIGN LOG</h2>
          <div className="rounded-lg border border-border bg-black/60 p-2 max-h-40 overflow-y-auto space-y-0.5">
            {campaignLog.map((line, i) => (
              <div key={i} className={`font-mono text-[10px] ${line.includes("✓") ? "text-neon-green" : line.includes("✗") ? "text-destructive" : "text-muted-foreground"}`}>
                {line}
              </div>
            ))}
          </div>
        </section>
      )}

      {sourceErrors.length > 0 && !running && (
        <section className="neon-card text-neon-purple p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="font-display tracking-[0.2em] text-sm">INVALID SOURCES</h2>
          </div>
          <div className="rounded-lg border border-border bg-black/50 divide-y divide-border">
            {sourceErrors.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-mono text-[11px] text-muted-foreground truncate min-w-0 flex-1">{r.input || "—"}</span>
                <span className="font-mono text-[11px] text-destructive truncate">{r.error}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(resolving || resolvedTargets.length > 0) && !running && (
        <section className="neon-card text-neon-cyan p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            {resolving ? <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" /> : resolvedTargets.some((r) => r.error) ? <AlertTriangle className="w-4 h-4 text-neon-red" /> : <CheckCircle2 className="w-4 h-4 text-neon-green" />}
            <h2 className="font-display tracking-[0.2em] text-sm">{resolving ? "RESOLVING TARGETS…" : "TARGET REAL IDS"}</h2>
          </div>
          <div className="rounded-lg border border-border bg-black/50 divide-y divide-border">
            {resolvedTargets.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-mono text-[11px] text-muted-foreground truncate min-w-0 flex-1">{r.input || "—"}</span>
                {r.error ? <span className="font-mono text-[11px] text-neon-red truncate">{r.error}</span> : <span className="font-mono text-[11px] text-neon-cyan truncate">{r.id}{r.title ? ` · ${r.title}` : ""}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {resolvedSources.length > 0 && !running && (
        <section className="neon-card text-neon-purple p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            {resolvedSources.some((r) => r.error) ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-neon-green" />}
            <h2 className="font-display tracking-[0.2em] text-sm">SOURCE REAL IDS</h2>
          </div>
          <div className="rounded-lg border border-border bg-black/50 divide-y divide-border">
            {resolvedSources.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-mono text-[11px] text-muted-foreground truncate min-w-0 flex-1">{r.input}</span>
                {r.error ? <span className="font-mono text-[11px] text-destructive truncate">{r.error}</span> : <span className="font-mono text-[11px] text-neon-purple truncate">{r.id}{r.title ? ` · ${r.title}` : ""}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {preflight.length > 0 && !running && (
        <section className="neon-card text-neon-green p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            {preflight.some((r) => !r.ok) ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-neon-green" />}
            <h2 className="font-display tracking-[0.2em] text-sm">BOT ACCESS PREFLIGHT</h2>
          </div>
          <div className="rounded-lg border border-border bg-black/50 divide-y divide-border">
            {preflight.map((r, i) => (
              <div key={i} className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-[9px] font-display tracking-wider px-1.5 py-0.5 rounded border ${r.role === "source" ? "text-neon-purple border-neon-purple/40" : "text-neon-cyan border-neon-cyan/40"}`}>
                      {r.role.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground truncate">{r.input}</span>
                  </span>
                  {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-neon-green shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                </div>
                <div className={`font-mono text-[10px] pl-1 ${r.ok ? "text-neon-green" : "text-destructive"}`}>{r.message}</div>
                {!r.ok && r.needsJoin && r.botUsername && (
                  <a href={`https://t.me/${r.botUsername}`} target="_blank" rel="noreferrer" className="inline-block font-mono text-[10px] text-neon-cyan underline pl-1">
                    Add @{r.botUsername} to this chat, then retry →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {running ? (
        <button onClick={stop} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg font-display tracking-[0.25em] text-sm bg-destructive/15 border border-destructive text-destructive animate-pulse-glow">
          <Square className="w-4 h-4 fill-current" />
          <span>STOP CAMPAIGN</span>
        </button>
      ) : (
        <button onClick={start} disabled={resolving || activeAccounts.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg font-display tracking-[0.25em] text-sm bg-neon-cyan border border-neon-cyan text-background animate-pulse-glow disabled:opacity-50">
          {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{resolving ? "RESOLVING…" : "LAUNCH CAMPAIGN"}</span>
        </button>
      )}
    </AppLayout>
  );
}

function ChannelList({
  label, icon: Icon, values, onChange, placeholder, accent, batchSize = 5,
}: {
  label: string;
  icon: typeof Link2;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  accent: "purple" | "cyan";
  batchSize?: number;
}) {
  const ring = accent === "purple" ? "focus:border-neon-purple focus:border-glow-purple" : "focus:border-neon-cyan focus:border-glow-cyan";
  const text = accent === "purple" ? "text-neon-purple" : "text-neon-cyan";
  const bg = accent === "purple" ? "bg-neon-purple/20" : "bg-neon-cyan/20";

  const totalBatches = Math.max(1, Math.ceil(values.length / batchSize));
  const [activeBatch, setActiveBatch] = useState(0);
  const showBatches = values.length > batchSize;
  const current = Math.min(activeBatch, totalBatches - 1);
  const startIdx = current * batchSize;
  const visible = values.slice(startIdx, startIdx + batchSize);

  const update = (i: number, v: string) => { const next = [...values]; next[i] = v; onChange(next); };
  const add = () => { const next = [...values, ""]; onChange(next); setActiveBatch(Math.floor((next.length - 1) / batchSize)); };
  const remove = (i: number) => onChange(values.length === 1 ? [""] : values.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${text}`} /> {label}
          <span className={`text-[10px] ${text}`}>({values.filter(Boolean).length})</span>
        </label>
        <button onClick={add} className={`flex items-center gap-1 text-[11px] tracking-wider uppercase ${text} px-2 py-1 rounded-md border border-current/40 hover:border-current transition-colors`}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {showBatches && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mr-1">Batches</span>
          {Array.from({ length: totalBatches }).map((_, i) => {
            const active = i === current;
            return (
              <button key={i} onClick={() => setActiveBatch(i)}
                className={`text-[10px] font-display tracking-wider px-2 py-1 rounded-md border transition-colors ${active ? `${bg} ${text} border-current` : "text-muted-foreground border-border"}`}>
                B{i + 1}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-2 space-y-2">
        {visible.map((v, vi) => {
          const i = startIdx + vi;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{i + 1}.</span>
              <input type="text" value={v} onChange={(e) => update(i, e.target.value)} placeholder={placeholder}
                className={`flex-1 bg-input/60 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-shadow ${ring}`} />
              <button onClick={() => remove(i)}
                className="grid place-items-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/60 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
