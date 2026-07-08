import jwt from 'jsonwebtoken';

// In production the app must be given a real secret — signing tokens with a
// known default would let anyone forge sessions. Outside production we keep a
// convenience fallback so local dev and tests run without configuration.
function resolveSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!configured || configured === 'default-secret') {
      throw new Error(
        'JWT_SECRET must be set to a strong, unique value in production. ' +
        'Refusing to start with a missing or default secret. See README → "Note for Developers".'
      );
    }
    return configured;
  }
  return configured || 'default-secret';
}

const JWT_SECRET = resolveSecret();
const JWT_EXPIRES_IN_SECONDS = 8 * 60 * 60; // 8 hours

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  orgId: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
