import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MongoClient } from "mongodb";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    process.env[key] ??= value;
  }
}

const uri = process.env.MONGODB_URI;
const email = process.env.ADMIN_EMAIL;
const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!uri || !password) {
  console.error("MONGODB_URI and ADMIN_PASSWORD are required.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const client = new MongoClient(uri, { appName: "jewellery-khazana-seed" });
await client.connect();

const db = client.db();
const users = db.collection("users");
try {
  await users.createIndex(
    { username: 1 },
    { unique: true, partialFilterExpression: { username: { $type: "string" } } }
  );
} catch (error) {
  if (error?.code !== 85 && error?.code !== 86) throw error;
}
try {
  await users.createIndex({ email: 1 }, { partialFilterExpression: { email: { $type: "string" } } });
} catch (error) {
  if (error?.code !== 85 && error?.code !== 86) throw error;
}

const now = new Date();
const normalizedEmail = email?.trim().toLowerCase();
const passwordHash = await bcrypt.hash(password, 12);
const result = await users.updateOne(
  { username },
  {
    $setOnInsert: {
      username,
      email: normalizedEmail,
      role: "admin",
      createdAt: now
    },
    $set: { name: username, passwordHash, active: true, updatedAt: now }
  },
  { upsert: true }
);

console.log(result.upsertedCount ? "Admin user created." : "Admin user already exists.");
await client.close();
