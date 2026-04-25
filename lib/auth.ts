import { cookies } from "next/headers";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";
import type { SessionUser, UserRole } from "./types";

const SESSION_COOKIE = "jk_session";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be set to at least 24 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT(user as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

async function verifyToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.id !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.username !== "string" ||
      (payload.role !== "admin" && payload.role !== "employee")
    ) {
      return null;
    }
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function getSessionFromRequest(request: NextRequest) {
  return verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function requireUser(role?: UserRole) {
  const user = await getSessionUser();
  if (!user || (role && user.role !== role)) {
    return null;
  }
  return user;
}
