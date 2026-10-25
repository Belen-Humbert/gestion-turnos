import { NextResponse, type NextRequest } from "next/server";

// Chequeo optimista: si no hay cookie de sesión, redirige al login sin tocar la base.
// La verificación real (sesión vigente y rol) se hace en cada página con requireUser().
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/paciente/:path*"],
};
