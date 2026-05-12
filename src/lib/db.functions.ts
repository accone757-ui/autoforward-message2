import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// Lazy factory — creates a fresh admin client inside each server function call
// so the credentials are resolved at runtime inside the split bundle context.
// We pass the `ws` package as Realtime transport because Node.js 20 has no
// native WebSocket and @supabase/realtime-js would throw otherwise.
function makeClient() {
  const url =
    process.env.SUPABASE_URL ||
    "https://vdkbetuwgozvbkzelmur.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxMDY5MCwiZXhwIjoyMDk0MDg2NjkwfQ.JGq_JII1T8LpKzYkzboahml89ygYx9U0v6K8sxW_mfA";
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = makeClient();
  const [selfCreated, purchased, totalMessages, banned, selfTotal, purchasedTotal] =
    await Promise.all([
      db.from("accounts").select("id", { count: "exact", head: true }).eq("type", "self_created").eq("status", "active"),
      db.from("accounts").select("id", { count: "exact", head: true }).eq("type", "purchased").eq("status", "active"),
      db.from("accounts").select("messages_sent"),
      db.from("accounts").select("id", { count: "exact", head: true }).in("status", ["banned", "restricted"]),
      db.from("accounts").select("id", { count: "exact", head: true }).eq("type", "self_created"),
      db.from("accounts").select("id", { count: "exact", head: true }).eq("type", "purchased"),
    ]);

  const messagesSent = (totalMessages.data ?? []).reduce((s, r) => s + (r.messages_sent ?? 0), 0);

  return {
    selfCreatedActive: selfCreated.count ?? 0,
    selfCreatedTotal: selfTotal.count ?? 0,
    purchasedActive: purchased.count ?? 0,
    purchasedTotal: purchasedTotal.count ?? 0,
    messagesSent,
    messagesFailed: 0,
    spamBanned: banned.count ?? 0,
    spamRestricted: 0,
  };
});

// ─── Accounts ────────────────────────────────────────────────────────────────

export const getAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const db = makeClient();
  const { data, error } = await db.from("accounts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createAccount = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { phone: string; session_string?: string; type?: "self_created" | "purchased"; region?: string }) => input,
  )
  .handler(async ({ data }) => {
    const db = makeClient();
    const { data: row, error } = await db
      .from("accounts")
      .insert({
        phone: data.phone,
        session_string: data.session_string ?? null,
        type: data.type ?? "self_created",
        region: data.region ?? "Unknown",
        status: "active",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAccountStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status: "active" | "idle" | "banned" | "restricted" }) => input)
  .handler(async ({ data }) => {
    const db = makeClient();
    const { error } = await db.from("accounts").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const db = makeClient();
    const { error } = await db.from("accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Products ────────────────────────────────────────────────────────────────

export const getProducts = createServerFn({ method: "GET" }).handler(async () => {
  const db = makeClient();
  const { data, error } = await db.from("products").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const upsertProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { id?: string; sku: string; region: string; price: number; stock: number; buy_link?: string }) => input,
  )
  .handler(async ({ data }) => {
    const db = makeClient();
    const { data: row, error } = await db
      .from("products")
      .upsert({ ...data, buy_link: data.buy_link ?? "https://t.me/digital_market1199" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const db = makeClient();
    const { error } = await db.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Users (Admin) ────────────────────────────────────────────────────────────

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = makeClient();
  const [total, active, banned, sessions] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("users").select("id", { count: "exact", head: true }).eq("status", "banned"),
    db.from("accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  return {
    totalUsers: total.count ?? 0,
    activeUsers: active.count ?? 0,
    bannedUsers: banned.count ?? 0,
    activeSessions: sessions.count ?? 0,
  };
});

export const getUsers = createServerFn({ method: "GET" }).handler(async () => {
  const db = makeClient();
  const { data, error } = await db.from("users").select("*").order("last_active", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const upsertUser = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id?: string;
      telegram_id: string;
      username: string;
      status?: "active" | "idle" | "banned";
      region?: string;
      account_count?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const db = makeClient();
    const { data: row, error } = await db
      .from("users")
      .upsert({ ...data, last_active: new Date().toISOString() }, { onConflict: "telegram_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateUserStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status: "active" | "idle" | "banned" }) => input)
  .handler(async ({ data }) => {
    const db = makeClient();
    const { error } = await db.from("users").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const getCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const db = makeClient();
  const { data, error } = await db.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const saveCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id?: string;
      name?: string;
      sources: string[];
      targets: string[];
      filters: Record<string, boolean>;
      delay_secs: number;
      loop: boolean;
      status: "running" | "stopped";
    }) => input,
  )
  .handler(async ({ data }) => {
    const db = makeClient();
    const { data: row, error } = await db
      .from("campaigns")
      .upsert({ ...data, last_run: data.status === "running" ? new Date().toISOString() : undefined })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const incrementCampaignMessages = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; count?: number }) => input)
  .handler(async ({ data }) => {
    const db = makeClient();
    const { data: existing } = await db.from("campaigns").select("messages_sent").eq("id", data.id).single();
    const current = existing?.messages_sent ?? 0;
    const { error } = await db
      .from("campaigns")
      .update({ messages_sent: current + (data.count ?? 1) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Setup / Health Check ─────────────────────────────────────────────────────

export const checkDbReady = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = makeClient();
    const { error } = await db.from("accounts").select("id").limit(1);
    console.log("[checkDbReady] result →", error?.message ?? "ok");
    if (error) return { ready: false, errors: [error.message] };
    return { ready: true, errors: [] };
  } catch (e) {
    console.error("[checkDbReady] threw:", e);
    return { ready: false, errors: [String(e)] };
  }
});
