import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/auth";
import { ordersCollection } from "@/lib/collections";
import { canExportReport } from "@/lib/reportTime";
import { normalizeDateInput, ORDER_STATUSES } from "@/lib/status";
import { calculateOrderStatus, normalizeLineItems, orderRemark } from "@/lib/orderItems";

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
  const user = await requireUser("admin");
  if (!user) {
    return NextResponse.json({ error: "Admin login required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const orderDate = month ? "" : normalizeDateInput(url.searchParams.get("date") ?? "");
  if (!month && !canExportReport(orderDate)) {
    return NextResponse.json({ error: "Excel report is available after 9 PM IST for today's orders." }, { status: 403 });
  }

  const orders = await ordersCollection();
  const filter = month ? { orderDate: { $gte: monthRange(month).start, $lte: monthRange(month).end } } : { orderDate };
  const rows = await orders.find(filter).sort({ orderDate: 1, createdAt: 1 }).toArray();
  const summaryRows: Array<{ Status: string; Total: number }> = ORDER_STATUSES.map((status) => ({
    Status: status,
    Total: rows.filter((row) => calculateOrderStatus(normalizeLineItems(row)) === status).length
  }));
  summaryRows.unshift({ Status: "Total orders", Total: rows.length });
  const sheetRows = rows.flatMap((row) => {
    const lineItems = normalizeLineItems(row);
    const orderStatus = calculateOrderStatus(lineItems);
    return lineItems.map((item, index) => ({
      "Order Date": row.orderDate,
      "Order Number": row.orderNumber,
      "Product #": index + 1,
      "Product Image": item.productImageUrl,
      "Payment Type": row.paymentType ?? "",
      "Order Status": orderStatus,
      "Product Status": item.status,
      Remark: item.employeeRemark || orderRemark(lineItems),
      "AWB Number": item.awbNumber,
      Employee: row.createdByName,
      "Created At": row.createdAt.toISOString(),
      "Updated At": row.updatedAt.toISOString()
    }));
  });

  const workbook = XLSX.utils.book_new();
  const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, worksheet, "Order Report");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="order-report-${month ?? orderDate}.xlsx"`
    }
  });
}
