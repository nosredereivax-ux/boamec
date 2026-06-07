import { writeFileSync } from "node:fs";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

const config = {
  env: process.env.BOAMEC_ENV || process.env.VERCEL_ENV || "production",
  appUrl: process.env.BOAMEC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "",
  supabaseUrl,
  supabaseAnonKey,
  productionAuth: Boolean(supabaseUrl && supabaseAnonKey)
};

const body = `window.BOAMEC_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
writeFileSync(new URL("../config.js", import.meta.url), body, "utf8");
console.log(`BOAMEC config generated for ${config.env}. Supabase: ${config.productionAuth ? "enabled" : "disabled"}`);
