export type Parsed = {
  kind: "public" | "private" | "username" | "numeric" | "unknown";
  username?: string;
  inviteHash?: string;
  numericId?: string;
  publicLink?: string;
};

export function parseInput(raw: string): Parsed {
  const v = raw.trim();
  if (!v) return { kind: "unknown" };

  if (/^-?\d+$/.test(v)) {
    let id = v;
    if (!id.startsWith("-")) id = `-100${id}`;
    return { kind: "numeric", numericId: id };
  }

  const s = v.replace(/^https?:\/\//i, "").replace(/^t\.me\//i, "").replace(/^telegram\.me\//i, "");

  if (s.startsWith("+") || s.startsWith("joinchat/")) {
    const hash = s.replace(/^joinchat\//, "").replace(/^\+/, "");
    return { kind: "private", inviteHash: hash };
  }

  const u = s.replace(/^@/, "").split(/[/?#]/)[0];
  if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(u)) {
    return {
      kind: v.startsWith("@") ? "username" : "public",
      username: u,
      publicLink: `https://t.me/${u}`,
    };
  }

  return { kind: "unknown" };
}
