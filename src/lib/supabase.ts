import { createClient } from "@supabase/supabase-js";

// Use || so empty string also falls through to the hardcoded default
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://vdkbetuwgozvbkzelmur.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA2OTAsImV4cCI6MjA5NDA4NjY5MH0.rUhVcEKEjANp6VdMBiVLDdhU_L7V0Pu9Oqj8oRLgGfo";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxMDY5MCwiZXhwIjoyMDk0MDg2NjkwfQ.JGq_JII1T8LpKzYkzboahml89ygYx9U0v6K8sxW_mfA";

// Public client — for browser / anon access
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Admin client — service role, bypasses RLS (server-side only)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export type Account = {
  id: string;
  phone: string;
  session_string: string | null;
  status: "active" | "idle" | "banned" | "restricted";
  type: "self_created" | "purchased";
  region: string;
  messages_sent: number;
  created_at: string;
};

export type Campaign = {
  id: string;
  name: string | null;
  sources: string[];
  targets: string[];
  filters: Record<string, boolean>;
  delay_secs: number;
  loop: boolean;
  status: "running" | "stopped";
  messages_sent: number;
  created_at: string;
  last_run: string | null;
};

export type Product = {
  id: string;
  sku: string;
  region: string;
  price: number;
  stock: number;
  buy_link: string;
  created_at: string;
};

export type User = {
  id: string;
  telegram_id: string;
  username: string;
  status: "active" | "idle" | "banned";
  region: string;
  account_count: number;
  created_at: string;
  last_active: string;
};
