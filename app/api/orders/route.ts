import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { ordersCollection } from "@/lib/collections";
import { isItemStatus, needsAwb, normalizeDateInput, ORDER_STATUSES, type ItemStatus } from "@/lib/status";
import { buildRemark, calculateOrderStatus, normalizeLineItems, orderRemark } from "@/lib/orderItems";
import type { OrderDocument, OrderLineItem } from "@/lib/types";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanPaymentType(value: unknown) {
  return value === "COD" ? "COD" : "Prepaid";
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function cleanProducts(value: unknown): OrderLineItem[] {
  const rawProducts = Array.isArray(value) ? value : [];
  return rawProducts
    .map((item) => {
      const productImageUrl = cleanText((item as Record<string, unknown>)?.productImageUrl);
      const status = cleanText((item as Record<string, unknown>)?.status);
      const awbNumber = cleanText((item as Record<string, unknown>)?.awbNumber);
      if (!productImageUrl || !isItemStatus(status)) return null;
      return {
        id: new ObjectId().toHexString(),
        productImageUrl,
        status,
        awbNumber: status === "Dispatched" ? awbNumber : "",
        employeeRemark: buildRemark(status)
      };
    })
    .filter((item): item is OrderLineItem => Boolean(item));
}

function toResponseRow(row: OrderDocument) {
  const lineItems = normalizeLineItems(row);
  const status = calculateOrderStatus(lineItems);
  return {
    ...row,
    _id: String(row._id),
    createdBy: String(row.createdBy),
    lineItems,
    status,
    productImageUrl: lineItems[0]?.productImageUrl ?? row.productImageUrl,
    awbNumber: lineItems.map((item) => item.awbNumber).filter(Boolean).join(", "),
    employeeRemark: orderRemark(lineItems)
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const orderDate = normalizeDateInput(url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
  const orders = await ordersCollection();
  const rows = await orders
    .find({ orderDate })
    .sort({ createdAt: -1 })
    .map(toResponseRow)
    .toArray();

  const totals = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<string, number>;
  for (const row of rows) totals[row.status] = (totals[row.status] ?? 0) + 1;

  return NextResponse.json({
    rows,
    totals: {
      total: rows.length,
      ...totals
    }
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderDate = normalizeDateInput(cleanText(body?.orderDate));
  const orderNumber = cleanText(body?.orderNumber);
  const paymentType = cleanPaymentType(body?.paymentType);
  const fallbackStatus = cleanText(body?.status);
  const fallbackProductImageUrl = cleanText(body?.productImageUrl);
  const fallbackAwbNumber = cleanText(body?.awbNumber);
  const lineItems = cleanProducts(body?.products);

  if (!lineItems.length && fallbackProductImageUrl && isItemStatus(fallbackStatus)) {
    lineItems.push({
      id: new ObjectId().toHexString(),
      productImageUrl: fallbackProductImageUrl,
      status: fallbackStatus,
      awbNumber: fallbackStatus === "Dispatched" ? fallbackAwbNumber : "",
      employeeRemark: buildRemark(fallbackStatus)
    });
  }

  if (!orderNumber || !lineItems.length) {
    return NextResponse.json({ error: "Order number and at least one product are required." }, { status: 400 });
  }
  if (lineItems.some((item) => needsAwb(item.status) && !item.awbNumber)) {
    return NextResponse.json({ error: "AWB number is required when status is Dispatched." }, { status: 400 });
  }

  const now = new Date();
  const status = calculateOrderStatus(lineItems);
  const orders = await ordersCollection();
  try {
    const result = await orders.insertOne({
      orderDate,
      orderNumber,
      productImageUrl: lineItems[0].productImageUrl,
      lineItems,
      paymentType,
      status,
      awbNumber: lineItems.map((item) => item.awbNumber).filter(Boolean).join(", "),
      employeeRemark: orderRemark(lineItems),
      createdBy: new ObjectId(user.id),
      createdByName: user.name,
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({ ok: true, id: String(result.insertedId) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ error: "This order number is already recorded for the selected date." }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = cleanText(body?.id);
  const itemId = cleanText(body?.itemId);
  const status = cleanText(body?.status) as ItemStatus;
  const awbNumber = cleanText(body?.awbNumber);

  if (!ObjectId.isValid(id) || !isItemStatus(status)) {
    return NextResponse.json({ error: "Valid order id and product status are required." }, { status: 400 });
  }
  if (needsAwb(status) && !awbNumber) {
    return NextResponse.json({ error: "AWB number is required when status is Dispatched." }, { status: 400 });
  }

  const orders = await ordersCollection();
  const order = await orders.findOne({ _id: new ObjectId(id) });

  if (!order) {
    return NextResponse.json({ error: "Order not found or not allowed." }, { status: 404 });
  }

  const lineItems = normalizeLineItems(order);
  const targetIndex = itemId ? lineItems.findIndex((item) => item.id === itemId) : 0;
  if (targetIndex < 0) {
    return NextResponse.json({ error: "Product line item not found." }, { status: 404 });
  }

  lineItems[targetIndex] = {
    ...lineItems[targetIndex],
    status,
    awbNumber: status === "Dispatched" ? awbNumber : "",
    employeeRemark: buildRemark(status)
  };
  const orderStatus = calculateOrderStatus(lineItems);
  await orders.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        lineItems,
        productImageUrl: lineItems[0].productImageUrl,
        status: orderStatus,
        awbNumber: lineItems.map((item) => item.awbNumber).filter(Boolean).join(", "),
        employeeRemark: orderRemark(lineItems),
        updatedAt: new Date()
      }
    }
  );

  return NextResponse.json({ ok: true });
}
