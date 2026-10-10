import { readFileSync, writeFileSync } from "node:fs";
const text = readFileSync(".env", "utf8");
const updated = text.replace(/^(DATABASE_URL\s*=\s*)(.*)$/m, (_, prefix, raw) => {
  const quote = ['"', "'"].includes(raw[0]) ? raw[0] : "";
  const value = quote ? raw.slice(1, -1) : raw.trim();
  const at = value.lastIndexOf("@");
  const start = value.indexOf(":", value.indexOf("://") + 3);
  if (at < 0 || start < 0) throw new Error("Connection format requires correction");
  let password = value.slice(start + 1, at);
  try { password = decodeURIComponent(password); } catch { /* Raw password. */ }
  return prefix + quote + value.slice(0, start + 1) + encodeURIComponent(password) + value.slice(at) + quote;
});
writeFileSync(".env", updated);
console.log("Database password encoding updated locally.");
