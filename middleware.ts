import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optional shared-password gate for a deployed instance.
 *
 * If APP_PASSWORD is set, the whole app requires HTTP Basic auth (any username,
 * password = APP_PASSWORD). If it's unset — e.g. local dev — the app is open.
 * This is deliberately the simplest thing that keeps a shared pilot private;
 * swap for real SSO/OAuth when you productionize (see DEPLOY.md).
 */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (pass === password) return NextResponse.next();
    } catch {
      /* fall through to challenge */
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AI Discovery", charset="UTF-8"' },
  });
}

export const config = {
  // Guard everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
