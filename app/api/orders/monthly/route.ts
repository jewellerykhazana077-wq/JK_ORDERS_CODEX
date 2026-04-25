import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ordersCollection } from "@/lib/collections";
import { ORDER_STATUSES } from "@/lib/status";
import { calculateOrderStatus, normalizeLineItems } from "@/lib/orderItems";

function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Month must be in YYYY-MM format.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  const end = `${year}-${String(monthNumber).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const range = monthRange(month);
  const orders = await ordersCollection();
  const rows = await orders
    .find({ orderDate: { $gte: range.start, $lte: range.end } }, { projection: { status: 1, paymentType: 1, lineItems: 1, productImageUrl: 1, awbNumber: 1, employeeRemark: 1, orderDate: 1, orderNumber: 1 } })
    .toArray();

  const statuses = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<string, number>;
  const payments = { Prepaid: 0, COD: 0 };
  for (const row of rows) {
    const status = calculateOrderStatus(normalizeLineItems(row));
    statuses[status] = (statuses[status] ?? 0) + 1;
    if (row.paymentType === "COD") payments.COD += 1;
    else payments.Prepaid += 1;
  }

  return NextResponse.json({
    month,
    rows: rows.map((row) => {
      const lineItems = normalizeLineItems(row);
      return {
        _id: String(row._id),
        orderDate: row.orderDate,
        orderNumber: row.orderNumber,
        paymentType: row.paymentType,
        lineItems,
        status: calculateOrderStatus(lineItems)
      };
    }),
    totals: {
      total: rows.length,
      ...statuses,
      payments
    }
  });
}
