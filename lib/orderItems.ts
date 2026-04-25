import type { OrderDocument, OrderLineItem } from "./types";
import type { ItemStatus, OrderStatus } from "./status";
import { ORDER_STATUSES } from "./status";

export function buildRemark(status: string) {
  if (status === "Not dispatched due to not in color") {
    return "This product could not be dispatched as not in stock due to not colored.";
  }
  if (status === "Not dispatched due to raw material not in stock") {
    return "This product could not be dispatched as not in stock due to the raw material not in stock.";
  }
  return "";
}

export function calculateOrderStatus(items: Array<{ status: ItemStatus }>): OrderStatus {
  if (!items.length) return "Unprocessed";
  const dispatched = items.filter((item) => item.status === "Dispatched").length;
  if (dispatched === items.length) return "Dispatched";
  if (dispatched > 0) return "Partially dispatched";
  const firstStatus = items[0]?.status ?? "Unprocessed";
  return items.every((item) => item.status === firstStatus) ? firstStatus : "Processing already";
}

export function normalizeLineItems(order: OrderDocument): OrderLineItem[] {
  if (Array.isArray(order.lineItems) && order.lineItems.length) {
    return order.lineItems.map((item, index) => ({
      id: item.id || `${String(order._id)}-${index}`,
      productImageUrl: item.productImageUrl,
      status: item.status,
      awbNumber: item.status === "Dispatched" ? item.awbNumber || "" : "",
      employeeRemark: item.employeeRemark ?? buildRemark(item.status)
    }));
  }

  const status = ORDER_STATUSES.includes(order.status) && order.status !== "Partially dispatched" ? order.status : "Unprocessed";
  return [
    {
      id: `${String(order._id)}-0`,
      productImageUrl: order.productImageUrl,
      status,
      awbNumber: status === "Dispatched" ? order.awbNumber || "" : "",
      employeeRemark: order.employeeRemark ?? buildRemark(status)
    }
  ];
}

export function orderRemark(items: OrderLineItem[]) {
  const remarks = Array.from(new Set(items.map((item) => item.employeeRemark).filter(Boolean)));
  return remarks.join(" | ");
}
