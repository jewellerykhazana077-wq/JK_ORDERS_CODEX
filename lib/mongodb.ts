import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

export const clientPromise =
  globalWithMongo._mongoClientPromise ??
  new MongoClient(uri, {
    appName: "jewellery-khazana-order-manager",
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 12000
  }).connect();

if (process.env.NODE_ENV !== "production") {
  globalWithMongo._mongoClientPromise = clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}
