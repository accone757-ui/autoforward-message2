import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, MapPin, Hash, ExternalLink, ImageOff } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getProducts } from "@/lib/db.functions";
import type { Product } from "@/lib/supabase";

export const Route = createFileRoute("/store")({
  loader: async () => {
    const products = await getProducts().catch(() => [] as Product[]);
    return { products: products as Product[] };
  },
  component: Store,
});

function Store() {
  const { products } = Route.useLoaderData();

  return (
    <AppLayout>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-neon-pink text-glow-pink">STORE</h1>
          <p className="mt-1 text-xs tracking-[0.2em] uppercase text-muted-foreground">
            V3 Digital Products · +1 Virtual Accounts
          </p>
        </div>
        <ShoppingBag className="w-8 h-8 text-neon-pink text-glow-pink" />
      </header>

      {products.length === 0 ? (
        <div className="neon-card text-neon-pink p-8 text-center">
          <ShoppingBag className="w-10 h-10 mx-auto text-neon-pink/40 mb-3" />
          <p className="text-sm text-muted-foreground">No products listed yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Admins can add products in the Admin Panel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((p) => (
            <article key={p.id} className="neon-card text-neon-pink hover:border-glow-pink transition-shadow overflow-hidden flex flex-col">
              {/* Product Image */}
              <div className="relative w-full aspect-video bg-black/40 border-b border-border overflow-hidden">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.sku}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/30">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-[10px] tracking-widest uppercase">No image</span>
                  </div>
                )}
                {/* Stock badge overlay */}
                <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border border-neon-green/60 bg-black/70 text-neon-green backdrop-blur-sm">
                  {p.stock} left
                </span>
              </div>

              {/* Card body */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> {p.sku}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm mb-4">
                  <MapPin className="w-4 h-4 text-neon-pink shrink-0" />
                  <span className="text-foreground">{p.region}</span>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Price</div>
                    <div className="font-display text-2xl font-bold text-neon-pink text-glow-pink">
                      ${Number(p.price).toFixed(2)}
                    </div>
                  </div>
                  <a
                    href={p.buy_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neon-pink/15 border border-neon-pink text-neon-pink border-glow-pink text-sm font-medium hover:bg-neon-pink/25 transition-colors"
                  >
                    Buy Now <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
