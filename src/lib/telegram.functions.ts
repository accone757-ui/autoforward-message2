import { createServerFn } from "@tanstack/react-start";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
type CachedChat = {
  expiresAt: number;
  value: { ok: true; id: string; type: string; title: string | null; username: string };
};
const chatCache = new Map<string, CachedChat>();

async function tgFetch(method: string, body: Record<string, unknown>) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: unknown;
  };
  return { httpOk: res.ok, status: res.status, ...json };
}

export const resolveTelegramChat = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string }) => {
    const u = String(data?.username ?? "").trim().replace(/^@/, "");
    if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(u)) throw new Error("Invalid username");
    return { username: u };
  })
  .handler(async ({ data }) => {
    const cacheKey = data.username.toLowerCase();
    const cached = chatCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true as const };
    if (cached) chatCache.delete(cacheKey);

    const r = await tgFetch("getChat", { chat_id: `@${data.username}` });
    if (!r.ok || !r.result) {
      return { ok: false as const, error: r.description || `Telegram error (${r.status})` };
    }
    const chat = r.result as { id: number; type: string; title?: string; username?: string };
    const value = {
      ok: true as const,
      id: String(chat.id),
      type: chat.type,
      title: chat.title ?? null,
      username: chat.username ?? data.username,
    };
    chatCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return { ...value, cached: false as const };
  });

let cachedBotId: number | null = null;
let cachedBotUsername: string | null = null;

async function getBotIdentity() {
  if (cachedBotId !== null) return { id: cachedBotId, username: cachedBotUsername };
  const r = await tgFetch("getMe", {});
  if (!r.ok || !r.result) throw new Error(r.description || "getMe failed");
  const me = r.result as { id: number; username?: string };
  cachedBotId = me.id;
  cachedBotUsername = me.username ?? null;
  return { id: cachedBotId, username: cachedBotUsername };
}

export const preflightCheckChat = createServerFn({ method: "POST" })
  .inputValidator((data: { chatId: string; role: "source" | "target" }) => {
    const id = String(data?.chatId ?? "").trim();
    if (!/^-?\d+$/.test(id)) throw new Error("Invalid chatId");
    if (data?.role !== "source" && data?.role !== "target") throw new Error("Invalid role");
    return { chatId: id, role: data.role };
  })
  .handler(async ({ data }) => {
    try {
      const bot = await getBotIdentity();
      const chatRes = await tgFetch("getChat", { chat_id: data.chatId });
      if (!chatRes.ok || !chatRes.result) {
        return {
          ok: false as const,
          error: chatRes.description || `Cannot access chat (${chatRes.status})`,
          needsJoin: /chat not found|bot is not a member|forbidden/i.test(chatRes.description ?? ""),
        };
      }
      const chat = chatRes.result as { type: string; title?: string };
      const memRes = await tgFetch("getChatMember", { chat_id: data.chatId, user_id: bot.id });
      if (!memRes.ok || !memRes.result) {
        return {
          ok: false as const,
          error: memRes.description || "Bot is not a member of this chat",
          needsJoin: true,
          botUsername: bot.username,
          chatType: chat.type,
          title: chat.title ?? null,
        };
      }
      const mem = memRes.result as { status: string; can_post_messages?: boolean };
      if (mem.status === "left" || mem.status === "kicked") {
        return {
          ok: false as const,
          error: `Bot is not in the chat (status: ${mem.status})`,
          needsJoin: true,
          botUsername: bot.username,
          chatType: chat.type,
          title: chat.title ?? null,
        };
      }
      if (data.role === "target" && (chat.type === "channel" || chat.type === "supergroup")) {
        const isAdmin = mem.status === "administrator" || mem.status === "creator";
        if (chat.type === "channel" && (!isAdmin || mem.can_post_messages === false)) {
          return {
            ok: false as const,
            error: "Bot needs admin rights with 'Post Messages' permission in this channel.",
            needsJoin: false,
            botUsername: bot.username,
            chatType: chat.type,
            title: chat.title ?? null,
          };
        }
      }
      return {
        ok: true as const,
        status: mem.status,
        chatType: chat.type,
        title: chat.title ?? null,
        botUsername: bot.username,
      };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Preflight failed", needsJoin: false };
    }
  });

export const forwardMessage = createServerFn({ method: "POST" })
  .inputValidator((data: { fromChatId: string; toChatId: string; messageId: number }) => data)
  .handler(async ({ data }) => {
    const r = await tgFetch("forwardMessage", {
      chat_id: data.toChatId,
      from_chat_id: data.fromChatId,
      message_id: data.messageId,
    });
    return { ok: r.ok, error: r.description };
  });

export const getChatHistory = createServerFn({ method: "POST" })
  .inputValidator((data: { chatId: string; limit?: number; offsetId?: number }) => data)
  .handler(async ({ data }) => {
    const r = await tgFetch("getUpdates", { offset: data.offsetId ?? 0, limit: data.limit ?? 10 });
    return { ok: r.ok, messages: (r.result as unknown[]) ?? [] };
  });
