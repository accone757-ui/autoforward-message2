import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Upload, DollarSign, Users, Activity, MoreVertical, Plus, Trash2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { getAdminStats, getUsers, updateUserStatus, upsertUser, upsertProduct, deleteProduct } from "@/lib/db.functions";
import { getProducts } from "@/lib/db.functions";
import type { User, Product } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const [statsRes, usersRes, productsRes] = await Promise.allSettled([
      getAdminStats(),
      getUsers(),
      getProducts(),
    ]);
    return {
      stats: statsRes.status === "fulfilled" ? statsRes.value : { totalUsers: 0, activeUsers: 0, bannedUsers: 0, activeSessions: 0 },
      users: usersRes.status === "fulfilled" ? usersRes.value : [],
      products: productsRes.status === "fulfilled" ? productsRes.value : [],
    };
  },
  component: Admin,
});

function Admin() {
  const { stats, users: initialUsers, products: initialProducts } = Route.useLoaderData();
  const [users, setUsers] = useState<User[]>(initialUsers as User[]);
  const [products, setProducts] = useState<Product[]>(initialProducts as Product[]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // New product form
  const [newSku, setNewSku] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  const updateStatusFn = useServerFn(updateUserStatus);
  const upsertProductFn = useServerFn(upsertProduct);
  const deleteProductFn = useServerFn(deleteProduct);

  const cycleStatus = async (user: User) => {
    const next: Record<string, "active" | "idle" | "banned"> = {
      active: "idle",
      idle: "banned",
      banned: "active",
    };
    const nextStatus = next[user.status] ?? "active";
    setLoadingId(user.id);
    try {
      await updateStatusFn({ data: { id: user.id, status: nextStatus } });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: nextStatus } : u));
    } finally {
      setLoadingId(null);
    }
  };

  const addProduct = async () => {
    if (!newSku || !newRegion || !newPrice) return;
    setSavingProduct(true);
    try {
      const row = await upsertProductFn({
        data: {
          sku: newSku,
          region: newRegion,
          price: parseFloat(newPrice),
          stock: parseInt(newStock) || 0,
        },
      });
      setProducts((prev) => [...prev, row as Product]);
      setNewSku(""); setNewRegion(""); setNewPrice(""); setNewStock("");
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProduct(false);
    }
  };

  const removeProduct = async (id: string) => {
    await deleteProductFn({ data: { id } });
    setProducts((prev) => prev.filter((p) => p.id !== id));
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

      <section className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.activeUsers} online`} icon={Users} color="cyan" />
        <StatCard label="Active Sessions" value={stats.activeSessions} sub={`${stats.bannedUsers} banned`} icon={Activity} color="purple" />
      </section>

      <section className="neon-card text-neon-cyan p-4 mb-4">
        <h2 className="font-display tracking-[0.2em] text-sm text-neon-cyan mb-3">MANAGE STORE PRODUCTS</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input placeholder="SKU (e.g. AC-1042)" value={newSku} onChange={(e) => setNewSku(e.target.value)}
            className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan col-span-2" />
          <input placeholder="Region" value={newRegion} onChange={(e) => setNewRegion(e.target.value)}
            className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan" />
          <input placeholder="Price (e.g. 3.50)" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
            className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan" />
          <input placeholder="Stock qty" type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)}
            className="bg-input/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neon-cyan" />
          <button
            onClick={addProduct}
            disabled={savingProduct || !newSku || !newRegion || !newPrice}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-neon-cyan text-neon-cyan text-sm hover:border-glow-cyan transition-shadow disabled:opacity-40"
          >
            {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Product
          </button>
        </div>
        {products.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 bg-black/30">
                <div>
                  <span className="font-mono text-xs text-neon-cyan">{p.sku}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.region}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neon-green font-mono">${Number(p.price).toFixed(2)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{p.stock} left</span>
                  <button onClick={() => removeProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="neon-card text-neon-purple p-4">
        <h2 className="font-display tracking-[0.2em] text-sm text-neon-purple mb-3">LIVE SESSIONS</h2>
        {users.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No users yet. Run the database migration first.</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">@{u.username}</div>
                  <div className="text-xs text-muted-foreground">{u.account_count} accounts · {u.region}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                      u.status === "active"
                        ? "border-neon-green text-neon-green"
                        : u.status === "idle"
                        ? "border-neon-cyan text-neon-cyan"
                        : "border-destructive text-destructive"
                    }`}
                  >
                    {u.status}
                  </span>
                  <button
                    onClick={() => cycleStatus(u)}
                    disabled={loadingId === u.id}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                    title="Cycle status"
                  >
                    {loadingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MoreVertical className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
