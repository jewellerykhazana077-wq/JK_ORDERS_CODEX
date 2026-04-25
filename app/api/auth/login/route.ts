import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { usersCollection } from "@/lib/collections";
import { createSessionToken } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

async function readLoginBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      username: String(form.get("username") ?? "").trim().toLowerCase(),
      password: String(form.get("password") ?? ""),
      isForm: true
    };
  }

  const body = await request.json().catch(() => null);
  return {
    username: String(body?.username ?? body?.email ?? "").trim().toLowerCase(),
    password: String(body?.password ?? ""),
    isForm: false
  };
}

async function withSessionCookie(response: NextResponse, user: SessionUser) {
  const token = await createSessionToken(user);
  response.cookies.set("jk_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

function loginRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

export async function POST(request: Request) {
  try {
    const { username, password, isForm } = await readLoginBody(request);

    if (!username || !password) {
      if (isForm) return loginRedirect(request, "/login?error=missing");
      return NextResponse.json({ error: "User ID and password are required." }, { status: 400 });
    }

    const users = await usersCollection();
    const user = await users.findOne({
      active: true,
      $or: [{ username }, { email: username }]
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (isForm) return loginRedirect(request, "/login?error=invalid");
      return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
    }

    const sessionUser = {
      id: String(user._id),
      name: user.name ?? user.username ?? user.email ?? "User",
      username: user.username ?? user.email ?? user.name,
      email: user.email,
      role: user.role
    };

    if (isForm) return withSessionCookie(loginRedirect(request, "/dashboard"), sessionUser);
    return withSessionCookie(NextResponse.json({ ok: true, role: user.role }), sessionUser);
  } catch {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      return loginRedirect(request, "/login?error=server");
    }
    return NextResponse.json(
      { error: "Login server could not reach MongoDB. Please check internet or MongoDB Atlas access." },
      { status: 503 }
    );
  }
}
