import { writeFileSync } from "node:fs";

const config = {
  env: process.env.BOAMEC_ENV || process.env.VERCEL_ENV || "production",
  appUrl: process.env.BOAMEC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  productionAuth: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
};

const body = `window.BOAMEC_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
writeFileSync(new URL("../config.js", import.meta.url), body, "utf8");
console.log(`BOAMEC config generated for ${config.env}. Supabase: ${config.productionAuth ? "enabled" : "disabled"}`);
