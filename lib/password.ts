import crypto from "crypto";

const TEMP_PASSWORD_BYTES = 9;

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) return false;
  return hashPassword(password) === passwordHash;
}

export function generateTempPassword() {
  return crypto
    .randomBytes(TEMP_PASSWORD_BYTES)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
}
