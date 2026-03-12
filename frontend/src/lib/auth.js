// frontend/lib/auth.js
// Server-side JWT verification helper

import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'blockchain-development-assignment',
);

/**
 * Verify JWT from cookie. Returns payload or throws.
 */
export async function verifyToken(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) throw new Error('Not authenticated');
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}

/**
 * Route guard – wrap API handlers with role check.
 * Usage: export const POST = withAuth(handler, "HOSPITAL")
 */
export function withAuth(handler, requiredRole = null) {
  return async (request, context) => {
    try {
      const payload = await verifyToken(request);
      if (requiredRole && payload.role !== requiredRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      request.user = payload;
      return handler(request, context);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  };
}
