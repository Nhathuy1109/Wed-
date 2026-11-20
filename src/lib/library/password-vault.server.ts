import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Sql } from "@/lib/db";

/** Bản sao mật khẩu được mã hóa AES-256-GCM bằng khóa PASSWORD_VAULT_KEY (biến môi trường).
 *  Chưa đặt khóa thì không lưu gì cả. */
const getKey = () => {
  const s = process.env.PASSWORD_VAULT_KEY;
  return s && s.length >= 16 ? createHash("sha256").update(s).digest() : null;
};

export async function saveCopy(sql: Sql, userId: string, password: string): Promise<void> {
  const key = getKey();
  if (!key) return;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(password, "utf8"), c.final()]);
  const cipher = Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
  await sql`
    insert into user_password_copy (user_id, cipher, updated_ms) values (${userId}, ${cipher}, ${Date.now()})
    on conflict (user_id) do update set cipher = excluded.cipher, updated_ms = excluded.updated_ms`;
}

export async function readCopy(sql: Sql, userId: string): Promise<{ status: "nokey" | "none" | "ok"; password?: string }> {
  const key = getKey();
  if (!key) return { status: "nokey" };
  const r = await sql<{ cipher: string }>`select cipher from user_password_copy where user_id = ${userId}`;
  if (!r[0]) return { status: "none" };
  try {
    const b = Buffer.from(r[0].cipher, "base64");
    const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return { status: "ok", password: Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8") };
  } catch {
    return { status: "none" };
  }
}
