import { getDb } from "./mongodb";
import type { OrderDocument, UserDocument } from "./types";

function isExistingIndexConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === 85 || error.code === 86)
  );
}

export async function usersCollection() {
  const db = await getDb();
  const collection = db.collection<UserDocument>("users");
  try {
    await collection.createIndex(
      { username: 1 },
      { unique: true, partialFilterExpression: { username: { $type: "string" } } }
    );
  } catch (error) {
    if (!isExistingIndexConflict(error)) throw error;
  }
  try {
    await collection.createIndex({ email: 1 }, { partialFilterExpression: { email: { $type: "string" } } });
  } catch (error) {
    if (!isExistingIndexConflict(error)) throw error;
  }
  return collection;
}

export async function ordersCollection() {
  const db = await getDb();
  const collection = db.collection<OrderDocument>("orders");
  await collection.createIndex({ orderDate: 1, orderNumber: 1 }, { unique: true });
  await collection.createIndex({ orderDate: 1, status: 1 });
  return collection;
}
