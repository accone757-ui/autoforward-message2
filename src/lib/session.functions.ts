import { createServerFn } from "@tanstack/react-start";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

type SendCodeResult =
  | { ok: true; phoneCodeHash: string }
  | { ok: false; error: string };

type SignInResult =
  | { ok: true; sessionString: string }
  | { ok: false; error: string; needs2FA?: boolean };

export const tgSendCode = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; apiId: number; apiHash: string }) => data)
  .handler(async ({ data }): Promise<SendCodeResult> => {
    try {
      const client = new TelegramClient(
        new StringSession(""),
        data.apiId,
        data.apiHash,
        { connectionRetries: 3 }
      );
      await client.connect();
      const result = await client.sendCode(
        { apiId: data.apiId, apiHash: data.apiHash },
        data.phone
      );
      await client.disconnect();
      return { ok: true, phoneCodeHash: result.phoneCodeHash };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to send code" };
    }
  });

export const tgSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    phone: string;
    apiId: number;
    apiHash: string;
    phoneCodeHash: string;
    code: string;
    password?: string;
  }) => data)
  .handler(async ({ data }): Promise<SignInResult> => {
    try {
      const client = new TelegramClient(
        new StringSession(""),
        data.apiId,
        data.apiHash,
        { connectionRetries: 3 }
      );
      await client.connect();
      try {
        await client.invoke(
          new (await import("telegram/tl/functions/auth/index.js")).SignIn({
            phoneNumber: data.phone,
            phoneCodeHash: data.phoneCodeHash,
            phoneCode: data.code,
          })
        );
      } catch (e: unknown) {
        const err = e as { errorMessage?: string; message?: string };
        const msg = err?.errorMessage ?? err?.message ?? "";
        if (msg.includes("SESSION_PASSWORD_NEEDED")) {
          if (!data.password) {
            await client.disconnect();
            return { ok: false, error: "2FA password required", needs2FA: true };
          }
          await client.signInWithPassword(
            { apiId: data.apiId, apiHash: data.apiHash },
            {
              password: async () => data.password!,
              onError: async (err: Error) => { throw err; },
            }
          );
        } else {
          await client.disconnect();
          return { ok: false, error: msg || "Sign in failed" };
        }
      }
      const sessionString = client.session.save() as unknown as string;
      await client.disconnect();
      return { ok: true, sessionString };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Sign in failed" };
    }
  });

export const tgForwardMessages = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sessionString: string;
    apiId: number;
    apiHash: string;
    fromChatId: string;
    toChatIds: string[];
    messageIds: number[];
    delaySecs: number;
    removeLinks: boolean;
    forwardName: boolean;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const client = new TelegramClient(
        new StringSession(data.sessionString),
        data.apiId,
        data.apiHash,
        { connectionRetries: 3 }
      );
      await client.connect();

      const results: { chatId: string; ok: boolean; error?: string }[] = [];

      for (const toChatId of data.toChatIds) {
        try {
          await client.invoke(
            new (await import("telegram/tl/functions/messages/index.js")).ForwardMessages({
              fromPeer: data.fromChatId,
              toPeer: toChatId,
              id: data.messageIds,
              dropAuthor: !data.forwardName,
            })
          );
          results.push({ chatId: toChatId, ok: true });
        } catch (e) {
          results.push({ chatId: toChatId, ok: false, error: e instanceof Error ? e.message : "Forward failed" });
        }
        if (data.delaySecs > 0) {
          await new Promise((r) => setTimeout(r, data.delaySecs * 1000));
        }
      }

      await client.disconnect();
      return { ok: true, results };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Connection failed", results: [] };
    }
  });

export const tgGetMessages = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sessionString: string;
    apiId: number;
    apiHash: string;
    chatId: string;
    limit?: number;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const client = new TelegramClient(
        new StringSession(data.sessionString),
        data.apiId,
        data.apiHash,
        { connectionRetries: 3 }
      );
      await client.connect();
      const messages = await client.getMessages(data.chatId, { limit: data.limit ?? 20 });
      await client.disconnect();
      return {
        ok: true,
        messages: messages.map((m) => ({
          id: m.id,
          date: m.date,
          text: m.text ?? "",
        })),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed", messages: [] };
    }
  });
