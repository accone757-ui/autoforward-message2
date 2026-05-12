import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Phone, Loader2, Check, ExternalLink, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
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

type Step = "form" | "otp" | "twofa" | "done";

function CreateAccount() {
  const { accounts: initialAccounts } = Route.useLoaderData();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);

  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [otp, setOtp] = useState("");
  const [twoFa, setTwoFa] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");

  const createFn = useServerFn(createAccount);
  const deleteFn = useServerFn(deleteAccount);
  const updateFn = useServerFn(updateAccountStatus);
  const sendCodeFn = useServerFn(tgSendCode);
  const signInFn = useServerFn(tgSignIn);

  const handleSendCode = async () => {
    if (!phone.trim() || !apiId.trim() || !apiHash.trim()) {
      setError("Phone, API ID နှင့် API Hash ဖြည့်ပါ။");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await sendCodeFn({ data: { phone: phone.trim(), apiId: parseInt(apiId), apiHash: apiHash.trim() } });
      if (!res.ok) { setError(res.error); return; }
      setPhoneCodeHash(res.phoneCodeHash);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code ပို့မရဘူး");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp.trim()) { setError("OTP ကုဒ် ရိုက်ထည့်ပါ။"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await signInFn({
        data: { phone: phone.trim(), apiId: parseInt(apiId), apiHash: apiHash.trim(), phoneCodeHash, code: otp.trim() },
      });
      if (!res.ok) {
        if (res.needs2FA) { setStep("twofa"); return; }
        setError(res.error);
        return;
      }
      await saveAccount(res.sessionString);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify မရဘူး");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFa.trim()) { setError("2FA Password ရိုက်ထည့်ပါ။"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await signInFn({
        data: { phone: phone.trim(), apiId: parseInt(apiId), apiHash: apiHash.trim(), phoneCodeHash, code: otp.trim(), password: twoFa },
      });
      if (!res.ok) { setError(res.error); return; }
      await saveAccount(res.sessionString);
    } catch (e) {
      setError(e instanceof Error ? e.message : "2FA မရဘူး");
    } finally {
      setLoading(false);
    }
  };

  const saveAccount = async (sessionString: string) => {
    const row = await createFn({
      data: {
        phone: phone.trim(),
        session_string: sessionString,
        api_id: parseInt(apiId),
        api_hash: apiHash.trim(),
        type: "self_created",
      } as Parameters<typeof createFn>[0]["data"],
    });
    setAccounts((prev) => [row as Account, ...prev]);
    setStep("done");
  };

  const reset = () => {
    setStep("form"); setPhone(""); setApiId(""); setApiHash("");
    setOtp(""); setTwoFa(""); setPhoneCodeHash(""); setError(null);
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

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-neon-green text-glow-green">AUTHORIZE</h1>
        <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Telegram Userbot Session ဖန်တီး
        </p>
      </header>

      <div className="neon-card p-5 mb-5">
        {step === "done" ? (
          <div className="text-center py-8">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-neon-green/10 border border-neon-green border-glow-green mb-4">
              <Check className="w-8 h-8 text-neon-green" />
            </div>
            <h3 className="font-display text-xl text-neon-green text-glow-green">Account Saved Successfully!</h3>
            <p className="text-xs text-muted-foreground mt-2">Userbot session database မှာ သိမ်းပြီးပြီ</p>
            <button
              onClick={reset}
              className="mt-6 px-5 py-2 rounded-lg border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 transition-colors text-sm"
            >
              နောက်ထပ် Account ထပ်ထည့်
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${step === "form" ? "bg-neon-cyan" : "bg-neon-green"}`} />
              <span className="text-xs text-muted-foreground tracking-wider uppercase">
                {step === "form" && "အချက်အလက် ဖြည့်ပါ"}
                {step === "otp" && "OTP ကုဒ် ထည့်ပါ"}
                {step === "twofa" && "2FA Password ထည့်ပါ"}
              </span>
            </div>

            {/* Phase 1: Credentials form */}
            <div>
              <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Phone Number</label>
              <input
                type="tel"
                placeholder="+95 9 xxx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={step !== "form"}
                className="mt-2 w-full bg-input/60 border border-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-neon-green focus:border-glow-green transition-shadow disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">API ID</label>
                <input
                  type="text"
                  placeholder="12345678"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  disabled={step !== "form"}
                  className="mt-2 w-full bg-input/60 border border-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-neon-green focus:border-glow-green transition-shadow disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">API Hash</label>
                <input
                  type="text"
                  placeholder="abc123def..."
                  value={apiHash}
                  onChange={(e) => setApiHash(e.target.value)}
                  disabled={step !== "form"}
                  className="mt-2 w-full bg-input/60 border border-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-neon-green focus:border-glow-green transition-shadow disabled:opacity-50"
                />
              </div>
            </div>

            {/* my.telegram.org link */}
            <a
              href="https://my.telegram.org"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              my.telegram.org မှ API ID နှင့် API Hash ထုတ်ယူပါ
            </a>
            <p className="text-[10px] text-muted-foreground -mt-2">
              my.telegram.org → Log in → API development tools → Create app
            </p>

            {/* Phase 2: OTP */}
            {(step === "otp" || step === "twofa") && (
              <div className="border-t border-border pt-4">
                <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
                  OTP Code — Telegram app မှ လာသော ကုဒ်
                </label>
                <input
                  type="text"
                  placeholder="12345"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={step === "twofa"}
                  className="mt-2 w-full bg-input/60 border border-border rounded-lg px-3 py-3 text-sm font-mono tracking-[0.3em] focus:outline-none focus:border-neon-cyan focus:border-glow-cyan transition-shadow disabled:opacity-50"
                />
              </div>
            )}

            {/* Phase 3: 2FA */}
            {step === "twofa" && (
              <div>
                <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
                  2FA Cloud Password
                </label>
                <input
                  type="password"
                  placeholder="Cloud password"
                  value={twoFa}
                  onChange={(e) => setTwoFa(e.target.value)}
                  className="mt-2 w-full bg-input/60 border border-border rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-neon-green focus:border-glow-green transition-shadow"
                />
                <p className="mt-1 text-xs text-neon-green">2FA ဖွင့်ထားတဲ့ account — cloud password ထည့်ပါ</p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Action button */}
            <div className="pt-1">
              {step === "form" && (
                <button
                  onClick={handleSendCode}
                  disabled={loading || !phone.trim() || !apiId.trim() || !apiHash.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-neon-cyan bg-neon-cyan/10 text-neon-cyan font-medium text-sm hover:bg-neon-cyan/20 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  Send Code
                </button>
              )}
              {step === "otp" && (
                <button
                  onClick={handleVerify}
                  disabled={loading || !otp.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-neon-green bg-neon-green/10 text-neon-green font-medium text-sm hover:bg-neon-green/20 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Verify &amp; Login
                </button>
              )}
              {step === "twofa" && (
                <button
                  onClick={handleVerify2FA}
                  disabled={loading || !twoFa.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-neon-green bg-neon-green/20 text-neon-green font-medium text-sm hover:bg-neon-green/30 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Sign In with 2FA
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Existing accounts list */}
      {accounts.length > 0 && (
        <section className="neon-card text-neon-cyan p-4">
          <h2 className="font-display tracking-[0.2em] text-sm text-neon-cyan mb-3">
            MY ACCOUNTS ({accounts.length})
          </h2>
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono text-foreground">{a.phone}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{a.type.replace("_", " ")}</span>
                    {a.api_id && <span className="font-mono text-neon-cyan/70">ID:{a.api_id}</span>}
                    {a.session_string ? (
                      <span className="text-neon-green">● session active</span>
                    ) : (
                      <span className="text-destructive">● no session</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => cycleStatus(a)}
                    title="Status ပြောင်း"
                    className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border transition-colors ${
                      a.status === "active"
                        ? "border-neon-green text-neon-green"
                        : a.status === "idle"
                        ? "border-neon-cyan text-neon-cyan"
                        : "border-destructive text-destructive"
                    }`}
                  >
                    {a.status}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="ဖျက်"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
