import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { WithId } from "mongodb";
import { usersCollection } from "@/lib/collections";
import { createSessionToken } from "@/lib/auth";
import type { SessionUser, UserDocument } from "@/lib/types";

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

async function bootstrapAdmin(username: string, password: string): Promise<WithId<UserDocument> | null> {
  const adminUsername = String(process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD ?? "");
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

  if (!adminUsername || !adminPassword || username !== adminUsername || password !== adminPassword) {
    return null;
  }

  const users = await usersCollection();
  const now = new Date();
  const update: Record<string, unknown> = {
    name: adminUsername,
    username: adminUsername,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    active: true,
    updatedAt: now
  };

  if (adminEmail) update.email = adminEmail;

  const result = await users.findOneAndUpdate(
    { username: adminUsername },
    {
      $set: update,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, returnDocument: "after" }
  );

  return result;
}

export async function POST(request: Request) {
  try {
    const { username, password, isForm } = await readLoginBody(request);

    if (!username || !password) {
      if (isForm) return loginRedirect(request, "/login?error=missing");
      return NextResponse.json({ error: "User ID and password are required." }, { status: 400 });
    }

    const users = await usersCollection();
    let user = await users.findOne({
      active: true,
      $or: [{ username }, { email: username }]
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      user = await bootstrapAdmin(username, password);
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (isForm) return loginRedirect(request, "/login?error=invalid");
      return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
    }

    const sessionUser = {
      id: String(user._id),
      name: user.name ?? user.username ?? user.email ?? "User",
      username: user.username ?? user.email ?? user.name,
      email: user.email,
      role: user.role,
      canEditOrders: user.role === "admin" || Boolean(user.canEditOrders)
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
