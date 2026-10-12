import jwt, { type SignOptions } from 'jsonwebtoken';

const DEFAULT_JWT_EXPIRES_IN = '7d';

/** Signs a session token. Tokens expire after JWT_EXPIRES_IN (e.g. "7d", "12h"; default 7d). */
export function signToken(userId: string) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  const expiresIn = (process.env.JWT_EXPIRES_IN?.trim() ||
    DEFAULT_JWT_EXPIRES_IN) as SignOptions['expiresIn'];
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}
