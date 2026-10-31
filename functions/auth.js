// Password hashing for stored admin/team-member accounts (Team & Roles).
// Uses Node's built-in scrypt — no extra dependency needed for a project this size.
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { passwordSalt: salt, passwordHash: hash };
}

export function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
