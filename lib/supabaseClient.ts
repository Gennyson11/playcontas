import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_URL = "https://lazueuycrcqirdykdppm.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_bOPpDSY1CpVBf-9KugNU8g_uQh2-9e_";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("your-project-id") &&
    !supabaseAnonKey.includes("your-anon-key")
);

export const supabase: any = createClient(supabaseUrl, supabaseAnonKey);
