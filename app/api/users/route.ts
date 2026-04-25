import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { usersCollection } from "@/lib/collections";

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET() {
  const user = await requireUser("admin");
  if (!user) {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const users = await usersCollection();
  const rows = await users
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .map((row) => ({ ...row, _id: String(row._id), username: row.username ?? row.email ?? row.name }))
    .toArray();

  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const admin = await requireUser("admin");
  if (!admin) {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = body?.role === "admin" ? "admin" : "employee";

  if (!username || password.length < 8) {
    return NextResponse.json({ error: "User ID and an 8+ character password are required." }, { status: 400 });
  }

  const now = new Date();
  const users = await usersCollection();
  try {
    const result = await users.insertOne({
      name: username,
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      active: true,
      createdAt: now,
      updatedAt: now
    });
    return NextResponse.json({ ok: true, id: String(result.insertedId) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ error: "A user with this user ID already exists." }, { status: 409 });
    }
    throw error;
  }
}
