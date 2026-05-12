import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Phone, KeyRound, ShieldCheck, Sparkles, Check, Loader2, Hash } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { createAccount, getAccounts, deleteAccount, updateAccountStatus } from "@/lib/db.functions";
import { tgSendCode, tgSignIn } from "@/lib/session.functions";
import type { Account } from "@/lib/supabase";

export const Route = createFileRoute("/create-account")({
  loader: async () => {
    const accounts = await getAccounts().catch(() => [] as Account[]);
    return { accounts: accounts as Account[] };
  },
  component: CreateAccount,
});

const steps = [
  { label: "Phone + API", icon: Phone },
  { label: "OTP Code", icon: KeyRound },
  { label: "2FA Password", icon: ShieldCheck },
  { label: "Generate Session", icon: Sparkles },
];

function CreateAccount() {
  const { accounts: initialAccounts } = Route.useLoaderData();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [otp, setOtp] = useState("");
  const [twoFa, setTwoFa] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);

  const createFn = useServerFn(createAccount);
  const deleteFn = useServerFn(deleteAccount);
  const updateFn = useServerFn(updateAccountStatus);
  const sendCodeFn = useServerFn(tgSendCode);
  const signInFn = useServerFn(tgSignIn);

  const handleSendCode = async () => {
    if (!phone || !apiId || !apiHash) {
      setError("Phone, API ID and API Hash are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await sendCodeFn({ data: { phone, apiId: parseInt(apiId), apiHash } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPhoneCodeHash(res.phoneCodeHash);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setSaving(false);
    }
  };

  const handleSignIn = async () => {
    if (!otp) { setError("Enter the OTP code."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await signInFn({
        data: { phone, apiId: parseInt(apiId), apiHash, phoneCodeHash, code: otp },
      });
      if (!res.ok) {
        if (res.needs2FA) {
          setNeeds2FA(true);
          setStep(2);
        } else {
          setError(res.error);
        }
        return;
      }
      await saveAccount(res.sessionString);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSignIn2FA = async () => {
    if (!twoFa) { setError("Enter your 2FA password."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await signInFn({
        data: { phone, apiId: parseInt(apiId), apiHash, phoneCodeHash, code: otp, password: twoFa },
      });
      if (!res.ok) { setError(res.error); return; }
      await saveAccount(res.sessionString);
    } catch (e) {
      setError(e instanceof Error ? e.message : "2FA sign in failed");
    } finally {
      setSaving(false);
    }
  };

  const saveAccount = async (sessionString: string) => {
    setStep(3);
    const row = await createFn({
      data: { phone, session_string: sessionString, type: "self_created", status: "active" } as Parameters<typeof createFn>[0]["data"],
    });
    setAccounts((prev) => [row as Account, ...prev]);
    setDone(true);
  };

  const handleDelete = async (id: string) => {
    await deleteFn({ data: { id } });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const cycleStatus = async (acc: Account) => {
    const next: Record<string, "active" | "idle" | "banned" | "restricted"> = {
      active: "idle", idle: "active", banned: "active", restricted: "active",
    };
    const nextStatus = next[acc.status] ?? "active";
    await updateFn({ data: { id: acc.id, status: nextStatus } });
    setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, status: nextStatus } : a));
  };

  const reset = () => {
    setDone(false); setStep(0); setPhone(""); setApiId(""); setApiHash("");
    setOtp(""); setTwoFa(""); setPhoneCodeHash(""); setNeeds2FA(false); setError(null);
  };

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-neon-green text-glow-green">AUTHORIZE</h1>
        <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">Create new userbot session</p>
      </header>

      <ol className="grid grid-cols-4 gap-2 mb-6">
        {steps.map((s, i) => {
          const active = i === step;
          const complete = i < step || done;
          return (
            <li key={s.label} className="flex flex-col items-center gap-2">
              <div className={`grid place-items-center w-10 h-10 rounded-full border transition-all ${
                complete ? "border-neon-green text-neon-green border-glow-green"
                  : active ? "border-neon-cyan text-neon-cyan border-glow-cyan"
                  : "border-border text-muted-foreground"
              }`}>
                {complete ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className="text-[9px] tracking-wider uppercase text-muted-foreground text-center leading-tight">{s.label}</span>
            </li>
          );
        })}
      </ol>

      <section className="neon-card text-neon-green p-5 mb-5">
        {done ? (
          <div className="text-center py-6">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-neon-green/10 border border-neon-green border-glow-green animate-pulse-glow text-neon-green mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="font-display text-xl text-neon-green text-glow-green">SESSION SAVED</h3>
            <p className="text-xs text-muted-foreground mt-1">Userbot session stored in database</p>
            <button onClick={reset} className="mt-5 px-5 py-2 rounded-lg border border-neon-cyan text-neon-cyan hover:border-glow-cyan transition-shadow text-sm">
              Add Another
            </button>
          </div>
        ) : (
          <>
            {step === 0 && (
              <div className="space-y-4">
                <Field label="Phone Number" placeholder="+95 9 xxx xxx xxx" hint="International format with country code" value={phone} onChange={setPhone} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="API ID" placeholder="12345678" hint="From my.telegram.org" value={apiId} onChange={setApiId} />
                  <Field label="API Hash" placeholder="abc123..." hint="From my.telegram.org" value={apiHash} onChange={setApiHash} />
                </div>
                <div className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="text-neon-cyan font-medium">API credentials:</span> my.telegram.org → Log in → API development tools → Create app
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <Field label="One-Time Code" placeholder="• • • • •" hint="Sent to your Telegram app" value={otp} onChange={setOtp} />
                <div className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-2 text-[11px] text-muted-foreground">
                  Phone: <span className="text-neon-cyan font-mono">{phone}</span>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <Field label="2FA Password" type="password" placeholder="Cloud password" hint="Required — your Telegram 2FA password" value={twoFa} onChange={setTwoFa} />
                {needs2FA && (
                  <div className="rounded-lg border border-neon-green/30 bg-neon-green/5 px-3 py-2 text-[11px] text-neon-green">
                    2FA is enabled on this account. Enter your cloud password to continue.
                  </div>
                )}
              </div>
            )}
            {step === 3 && (
              <div className="text-center py-4">
                <Sparkles className="w-10 h-10 mx-auto text-neon-cyan text-glow-cyan" />
                <p className="mt-3 text-sm text-muted-foreground">Saving session to database…</p>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => { setStep(Math.max(0, step - 1)); setError(null); }}
                disabled={step === 0}
                className="px-4 py-2 text-sm text-muted-foreground disabled:opacity-30"
              >
                Back
              </button>
              {step === 0 && (
                <button
                  onClick={handleSendCode}
                  disabled={saving || !phone || !apiId || !apiHash}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg border border-neon-cyan text-neon-cyan hover:border-glow-cyan transition-shadow text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Send OTP
                </button>
              )}
              {step === 1 && (
                <button
                  onClick={handleSignIn}
                  disabled={saving || !otp}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg border border-neon-cyan text-neon-cyan hover:border-glow-cyan transition-shadow text-sm font-medium disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Verify OTP
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleSignIn2FA}
                  disabled={saving || !twoFa}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-neon-green/20 border border-neon-green text-neon-green border-glow-green text-sm font-medium disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Sign In
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {accounts.length > 0 && (
        <section className="neon-card text-neon-cyan p-4">
          <h2 className="font-display tracking-[0.2em] text-sm text-neon-cyan mb-3">MY ACCOUNTS ({accounts.length})</h2>
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-mono text-foreground">{a.phone}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {a.type.replace("_", " ")} · {a.region}
                    {a.session_string ? (
                      <span className="ml-2 text-neon-green">● session active</span>
                    ) : (
                      <span className="ml-2 text-destructive">● no session</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cycleStatus(a)}
                    className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      a.status === "active" ? "border-neon-green text-neon-green"
                        : a.status === "idle" ? "border-neon-cyan text-neon-cyan"
                        : "border-destructive text-destructive"
                    }`}
                  >
                    {a.status}
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppLayout>
  );
}

function Field({
  label, placeholder, type = "text", hint, value, onChange,
}: { label: string; placeholder: string; type?: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-input/60 border border-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-neon-green focus:border-glow-green transition-shadow"
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
