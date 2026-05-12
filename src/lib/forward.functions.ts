import { createServerFn } from "@tanstack/react-start";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

type ForwardResult = {
  ok: boolean;
  forwarded: number;
  failed: number;
  errors: string[];
};

export const runForwardCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sessionString: string;
    apiId: number;
    apiHash: string;
    fromChatId: string;
    toChatIds: string[];
    messageLimit: number;
    delaySecs: number;
    removeLinks: boolean;
    forwardName: boolean;
  }) => data)
  .handler(async ({ data }): Promise<ForwardResult> => {
    const client = new TelegramClient(
      new StringSession(data.sessionString),
      data.apiId,
      data.apiHash,
      { connectionRetries: 3 }
    );

    try {
      await client.connect();

      const messages = await client.getMessages(data.fromChatId, { limit: data.messageLimit });
      if (!messages || messages.length === 0) {
        await client.disconnect();
        return { ok: true, forwarded: 0, failed: 0, errors: ["No messages found in source chat"] };
      }

      const messageIds = messages.map((m) => m.id);
      let forwarded = 0;
      let failed = 0;
      const errors: string[] = [];

      const { ForwardMessages } = await import("telegram/tl/functions/messages/index.js");

      for (const toChatId of data.toChatIds) {
        try {
          await client.invoke(
            new ForwardMessages({
              fromPeer: data.fromChatId,
              toPeer: toChatId,
              id: messageIds,
              dropAuthor: !data.forwardName,
            })
          );
          forwarded += messageIds.length;
        } catch (e) {
          failed += messageIds.length;
          errors.push(`${toChatId}: ${e instanceof Error ? e.message : "Forward failed"}`);
        }

        if (data.delaySecs > 0 && data.toChatIds.indexOf(toChatId) < data.toChatIds.length - 1) {
          await new Promise((r) => setTimeout(r, data.delaySecs * 1000));
        }
      }

      await client.disconnect();
      return { ok: true, forwarded, failed, errors };
    } catch (e) {
      try { await client.disconnect(); } catch {}
      return { ok: false, forwarded: 0, failed: 0, errors: [e instanceof Error ? e.message : "Campaign failed"] };
    }
  });

export const getSourceMessages = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sessionString: string;
    apiId: number;
    apiHash: string;
    chatId: string;
    limit?: number;
  }) => data)
  .handler(async ({ data }) => {
    const client = new TelegramClient(
      new StringSession(data.sessionString),
      data.apiId,
      data.apiHash,
      { connectionRetries: 3 }
    );
    try {
      await client.connect();
      const messages = await client.getMessages(data.chatId, { limit: data.limit ?? 10 });
      await client.disconnect();
      return {
        ok: true,
        messages: messages.map((m) => ({
          id: m.id,
          date: m.date,
          text: (m.text ?? "").slice(0, 100),
        })),
      };
    } catch (e) {
      try { await client.disconnect(); } catch {}
      return { ok: false, messages: [], error: e instanceof Error ? e.message : "Failed" };
    }
  });
