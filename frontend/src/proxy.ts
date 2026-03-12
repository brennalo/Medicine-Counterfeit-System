import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'blockchain-development-assignment',
);

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // If trying to access protected routes without a token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Role-based protection
    if (pathname.startsWith('/hospital') && payload.role !== 'HOSPITAL') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (
      pathname.startsWith('/manufacturer') &&
      payload.role !== 'MANUFACTURER'
    ) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch {
    // Token invalid/expired
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/hospital/:path*', '/manufacturer/:path*'],
};
