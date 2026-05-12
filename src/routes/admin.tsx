import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Shield, Users, Activity, Plus, Trash2, Loader2,
  Smartphone, CheckCircle2, XCircle, Search,
  ImagePlus, X, ExternalLink,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import {
  getAdminStats, getUsers, updateUserStatus,
  upsertProduct, deleteProduct, getProducts,
  getAccounts, deleteAccount, updateAccountStatus,
  uploadProductImage,
} from "@/lib/db.functions";
import type { User, Product, Account } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const [statsRes, usersRes, productsRes, accountsRes] = await Promise.allSettled([
      getAdminStats(),
      getUsers(),
      getProducts(),
      getAccounts(),
    ]);
    return {
      stats: statsRes.status === "fulfilled"
        ? statsRes.value
        : { totalUsers: 0, activeUsers: 0, bannedUsers: 0, activeSessions: 0 },
      users: usersRes.status === "fulfilled" ? usersRes.value : [],
      products: productsRes.status === "fulfilled" ? productsRes.value : [],
      accounts: accountsRes.status === "fulfilled" ? accountsRes.value : [],
    };
  },
  component: Admin,
});

const STATUS_CYCLE: Record<string, "active" | "idle" | "banned" | "restricted"> = {
  active: "idle", idle: "banned", banned: "active", restricted: "active",
};
const STATUS_COLOR: Record<string, string> = {
  active: "border-neon-green text-neon-green",
  idle: "border-neon-cyan text-neon-cyan",
  banned: "border-destructive text-destructive",
  restricted: "border-yellow-500 text-yellow-400",
};

function Admin() {
  const { stats, users: initialUsers, products: initialProducts, accounts: initialAccounts } = Route.useLoaderData();

  const [users, setUsers] = useState<User[]>(initialUsers as User[]);
  const [products, setProducts] = useState<Product[]>(initialProducts as Product[]);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts as Account[]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Userbot filter / bulk
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "idle" | "banned" | "restricted">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Product form
  const [newSku, setNewSku] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newBuyLink, setNewBuyLink] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [imageName, setImageName] = useState<string>("photo.jpg");
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateUserStatusFn = useServerFn(updateUserStatus);
  const upsertProductFn = useServerFn(upsertProduct);
  const deleteProductFn = useServerFn(deleteProduct);
  const updateAccountFn = useServerFn(updateAccountStatus);
  const deleteAccountFn = useServerFn(deleteAccount);
  const uploadImageFn = useServerFn(uploadProductImage);

  // ── Image picker ───────────────────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setProductError("Image 5MB ထက်မကျော်ရ"); return; }
    setProductError(null);
    setImageMime(file.type || "image/jpeg");
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      // Strip data URL prefix to get pure base64
      setImageBase64(result.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Add product ────────────────────────────────────────────────────────────

  const addProduct = async () => {
    if (!newSku.trim() || !newRegion.trim() || !newPrice) {
      setProductError("SKU, Region, Price ဖြည့်ပါ");
      return;
    }
    setProductError(null);
    setSavingProduct(true);
    try {
      let imageUrl: string | null = null;

      // Upload image first if selected
      if (imageBase64) {
        setUploadingImage(true);
        try {
          const res = await uploadImageFn({
            data: { base64: imageBase64, mimeType: imageMime, fileName: imageName },
          });
          imageUrl = res.url;
        } catch (e) {
          setProductError(`Image upload မရဘူး: ${e instanceof Error ? e.message : "Unknown"}`);
          setSavingProduct(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      const row = await upsertProductFn({
        data: {
          sku: newSku.trim(),
          region: newRegion.trim(),
          price: parseFloat(newPrice),
          stock: parseInt(newStock) || 0,
          buy_link: newBuyLink.trim() || "https://t.me/digital_market1199",
          image_url: imageUrl,
        },
      });
      setProducts((prev) => [...prev, row as Product]);
      setNewSku(""); setNewRegion(""); setNewPrice(""); setNewStock(""); setNewBuyLink("");
      clearImage();
    } catch (e) {
      setProductError(e instanceof Error ? e.message : "Save မရဘူး");
    } finally {
      setSavingProduct(false);
    }
  };

  const removeProduct = async (id: string) => {
    if (!confirm("Product ကို ဖျက်မှာ သေချာလား?")) return;
    setLoadingId(id);
    try {
      await deleteProductFn({ data: { id } });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setLoadingId(null);
    }
  };

  // ── Userbot helpers ────────────────────────────────────────────────────────

  const filteredAccounts = accounts.filter((a) => {
    const matchSearch = !search || a.phone.includes(search) || (a.api_id?.toString() ?? "").includes(search);
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const allSelected = filteredAccounts.length > 0 && filteredAccounts.every((a) => selected.has(a.id));

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(filteredAccounts.map((a) => a.id)));
  };

  const cycleAccountStatus = async (acc: Account) => {
    const next = STATUS_CYCLE[acc.status] ?? "active";
    setLoadingId(acc.id);
    try {
      await updateAccountFn({ data: { id: acc.id, status: next } });
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, status: next } : a));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Userbot ကို ဖျက်မှာ သေချာလား?")) return;
    setLoadingId(id);
    try {
      await deleteAccountFn({ data: { id } });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } finally {
      setLoadingId(null);
    }
  };

  const bulkSetStatus = async (status: "active" | "idle" | "banned" | "restricted") => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map((id) => updateAccountFn({ data: { id, status } })));
      setAccounts((prev) => prev.map((a) => selected.has(a.id) ? { ...a, status } : a));
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} userbot ကို ဖျက်မှာ သေချာလား?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map((id) => deleteAccountFn({ data: { id } })));
      setAccounts((prev) => prev.filter((a) => !selected.has(a.id)));
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const botActive = accounts.filter((a) => a.status === "active" && a.session_string).length;
  const botIdle = accounts.filter((a) => a.status === "idle").length;
  const botBanned = accounts.filter((a) => a.status === "banned" || a.status === "restricted").length;
  const botNoSession = accounts.filter((a) => !a.session_string).length;

  const cycleUserStatus = async (user: User) => {
    const next: Record<string, "active" | "idle" | "banned"> = {
      active: "idle", idle: "banned", banned: "active",
    };
    const nextStatus = next[user.status] ?? "active";
    setLoadingId(user.id);
    try {
      await updateUserStatusFn({ data: { id: user.id, status: nextStatus } });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: nextStatus } : u));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <AppLayout>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-neon-purple text-glow-purple">ADMIN PANEL</h1>
          <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">Restricted · Owner access</p>
        </div>
        <Shield className="w-8 h-8 text-neon-purple text-glow-purple" />
      </header>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.activeUsers} online`} icon={Users} color="cyan" />
        <StatCard label="Active Userbots" value={botActive} sub={`${botBanned} banned`} icon={Activity} color="purple" />
      </section>

      {/* ── Userbot Control ───────────────────────────────────────────────── */}
      <section className="neon-card p-4 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-neon-green" />
          <h2 className="font-display tracking-[0.2em] text-sm text-neon-green">USERBOT CONTROL</h2>
          <span className="font-display text-lg font-bold text-neon-green text-glow-green ml-1">{accounts.length}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Active", value: botActive, color: "text-neon-green border-neon-green/30 bg-neon-green/5" },
            { label: "Idle", value: botIdle, color: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5" },
            { label: "Banned", value: botBanned, color: "text-destructive border-destructive/30 bg-destructive/5" },
            { label: "No Session", value: botNoSession, color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border px-2 py-2 text-center ${s.color}`}>
              <div className="font-display text-xl font-bold">{s.value}</div>
              <div className="text-[9px] tracking-widest uppercase mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="Phone or API ID ရှာ…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-input/60 border border-border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-neon-green" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none text-foreground">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="banned">Banned</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-neon-cyan font-medium">{selected.size} ရွေးထားသည်</span>
            {bulkLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-cyan" />}
            <button onClick={() => bulkSetStatus("active")} disabled={bulkLoading}
              className="text-[11px] px-2.5 py-1 rounded-md border border-neon-green/50 text-neon-green hover:bg-neon-green/10 disabled:opacity-40">Activate All</button>
            <button onClick={() => bulkSetStatus("idle")} disabled={bulkLoading}
              className="text-[11px] px-2.5 py-1 rounded-md border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-40">Idle All</button>
            <button onClick={() => bulkSetStatus("banned")} disabled={bulkLoading}
              className="text-[11px] px-2.5 py-1 rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-40">Ban All</button>
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="text-[11px] px-2.5 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 ml-auto">Delete Selected</button>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Userbot မရှိသေးဘူး။ Client တွေ Create Account မှာ ဖန်တီးရင် ဒီမှာ ပေါ်မည်။
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">ကိုက်ညီသော userbot မရှိဘူး</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-3 py-2 bg-black/40 border-b border-border text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-neon-green" />
              <span>Phone / API ID</span>
              <span className="text-center">Session</span>
              <span className="text-center">Msgs</span>
              <span className="text-center">Status</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {filteredAccounts.map((acc) => (
                <li key={acc.id}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-3 py-3 transition-colors ${selected.has(acc.id) ? "bg-neon-green/5" : "hover:bg-white/[0.02]"}`}>
                  <input type="checkbox" checked={selected.has(acc.id)} onChange={() => toggleSelect(acc.id)} className="accent-neon-green" />
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-foreground truncate">{acc.phone}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      {acc.api_id ? <span className="text-neon-cyan/70 font-mono">ID:{acc.api_id}</span> : <span className="text-yellow-500/70">No API creds</span>}
                      <span className="text-border">·</span>
                      <span>{acc.type.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    {acc.session_string
                      ? <CheckCircle2 className="w-4 h-4 text-neon-green" />
                      : <XCircle className="w-4 h-4 text-destructive/60" />}
                  </div>
                  <div className="text-center font-mono text-xs text-muted-foreground min-w-[36px]">{acc.messages_sent ?? 0}</div>
                  <button onClick={() => cycleAccountStatus(acc)} disabled={loadingId === acc.id}
                    className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${STATUS_COLOR[acc.status] ?? "border-border text-muted-foreground"}`}>
                    {loadingId === acc.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : acc.status}
                  </button>
                  <button onClick={() => handleDeleteAccount(acc.id)} disabled={loadingId === acc.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-[10px] text-muted-foreground">Status badge ကို click နှိပ်ပြီး ပြောင်းနိုင်သည်: active → idle → banned</p>
      </section>

      {/* ── Store Products ─────────────────────────────────────────────────── */}
      <section className="neon-card text-neon-cyan p-4 mb-4">
        <h2 className="font-display tracking-[0.2em] text-sm text-neon-cyan mb-4">MANAGE STORE PRODUCTS</h2>

        <div className="space-y-3">
          {/* Image upload zone */}
          <div>
            <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground block mb-2">
              Product Image (optional · max 5MB)
            </label>
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-neon-cyan/40 aspect-video">
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                <button onClick={clearImage}
                  className="absolute top-2 right-2 grid place-items-center w-7 h-7 rounded-full bg-black/70 text-white hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 text-neon-cyan text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-neon-cyan/30 hover:border-neon-cyan/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-neon-cyan transition-colors">
                <ImagePlus className="w-8 h-8" />
                <span className="text-xs tracking-wider">Click to upload image</span>
                <span className="text-[10px]">JPG, PNG, WebP, GIF</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect} className="hidden" />
          </div>

          {/* Product fields */}
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="SKU (e.g. AC-1042)" value={newSku} onChange={(e) => setNewSku(e.target.value)}
              className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan col-span-2" />
            <input placeholder="Region (e.g. Myanmar 🇲🇲)" value={newRegion} onChange={(e) => setNewRegion(e.target.value)}
              className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan col-span-2" />
            <input placeholder="Price (e.g. 3.50)" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
              className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan" />
            <input placeholder="Stock qty" type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)}
              className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan" />
            <input placeholder="Buy link (t.me/... or leave blank)" value={newBuyLink} onChange={(e) => setNewBuyLink(e.target.value)}
              className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan col-span-2" />
          </div>

          {productError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {productError}
            </div>
          )}

          <button onClick={addProduct} disabled={savingProduct || !newSku.trim() || !newRegion.trim() || !newPrice}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neon-cyan text-neon-cyan text-sm hover:bg-neon-cyan/10 transition-colors disabled:opacity-40">
            {savingProduct
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploadingImage ? "Uploading image…" : "Saving…"}</>
              : <><Plus className="w-4 h-4" /> Add Product</>}
          </button>
        </div>

        {/* Products list */}
        {products.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border overflow-hidden">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 bg-black/30 hover:bg-black/50 transition-colors">
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-md overflow-hidden border border-border shrink-0 bg-black/40">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.sku} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <ImagePlus className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-neon-cyan">{p.sku}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{p.stock} left</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.region}</div>
                </div>

                <span className="text-sm text-neon-green font-mono shrink-0">${Number(p.price).toFixed(2)}</span>

                <a href={p.buy_link} target="_blank" rel="noreferrer"
                  className="text-muted-foreground hover:text-neon-cyan transition-colors shrink-0" title="Buy link">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button onClick={() => removeProduct(p.id)} disabled={loadingId === p.id}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 shrink-0">
                  {loadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Platform Users ──────────────────────────────────────────────────── */}
      <section className="neon-card text-neon-purple p-4">
        <h2 className="font-display tracking-[0.2em] text-sm text-neon-purple mb-3">PLATFORM USERS</h2>
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">User မရှိသေးဘူး</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">@{u.username}</div>
                  <div className="text-xs text-muted-foreground">{u.account_count} accounts · {u.region}</div>
                </div>
                <button onClick={() => cycleUserStatus(u)} disabled={loadingId === u.id}
                  className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                    u.status === "active" ? "border-neon-green text-neon-green"
                      : u.status === "idle" ? "border-neon-cyan text-neon-cyan"
                      : "border-destructive text-destructive"
                  }`}>
                  {loadingId === u.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : u.status}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
