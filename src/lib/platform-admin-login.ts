import { timingSafeEqual } from "node:crypto";

const privateLoginKeyPattern = /^[a-f0-9]{64}$/i;

export function getPlatformAdminLoginPath() {
  const key = process.env.FACTURO_ADMIN_LOGIN_KEY;
  if (!key || !privateLoginKeyPattern.test(key)) {
    throw new Error("FACTURO_ADMIN_LOGIN_KEY must be configured as a 64-character hexadecimal secret.");
  }
  return `/admin/access/${key}`;
}

export function isPlatformAdminLoginKey(candidate: string) {
  const expected = process.env.FACTURO_ADMIN_LOGIN_KEY;
  if (!expected || !privateLoginKeyPattern.test(expected) || !privateLoginKeyPattern.test(candidate)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const candidateBytes = Buffer.from(candidate, "hex");
  return expectedBytes.length === candidateBytes.length && timingSafeEqual(expectedBytes, candidateBytes);
}
