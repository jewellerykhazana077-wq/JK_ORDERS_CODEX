export const ORDER_STATUSES = [
  "Unprocessed",
  "Processing already",
  "Not dispatched due to not in color",
  "Not dispatched due to raw material not in stock",
  "Partially dispatched",
  "Dispatched"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ITEM_STATUSES = ORDER_STATUSES.filter((status) => status !== "Partially dispatched") as Exclude<
  OrderStatus,
  "Partially dispatched"
>[];

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  Unprocessed: "Unprocessed",
  "Processing already": "Processing",
  "Not dispatched due to not in color": "Not in color",
  "Not dispatched due to raw material not in stock": "Raw material not in stock",
  "Partially dispatched": "Partially dispatched",
  Dispatched: "Dispatched"
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && ITEM_STATUSES.includes(value as ItemStatus);
}

export function needsAwb(status: OrderStatus | ItemStatus) {
  return status === "Dispatched";
}

export function normalizeDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Order date must be in YYYY-MM-DD format.");
  }
  return value;
}
