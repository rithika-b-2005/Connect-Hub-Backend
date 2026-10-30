import { createHmac, timingSafeEqual } from 'crypto';

// A JWT is stateless, so it cannot know that the account behind it was
// deleted, demoted, or had its password changed. Binding the token to the
// user's current credential state fixes that without a schema change:
//
//   password changes -> the bcrypt hash changes -> the binding changes
//   role changes     -> the binding changes
//   account deleted  -> there is no row to verify against
//
// The token is rejected unless the binding in the JWT still matches the
// database. The secret never leaves the server and the password hash is only
// ever used as HMAC input.

export function signTokenBinding(
  secret: string,
  passwordHash: string,
  role: string,
): string {
  return createHmac('sha256', secret)
    .update(`${passwordHash}:${role}`)
    .digest('base64url');
}

export function verifyTokenBinding(
  secret: string,
  passwordHash: string,
  role: string,
  binding: string | undefined,
): boolean {
  if (!binding) return false;

  const expected = Buffer.from(signTokenBinding(secret, passwordHash, role));
  const actual = Buffer.from(binding);

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
