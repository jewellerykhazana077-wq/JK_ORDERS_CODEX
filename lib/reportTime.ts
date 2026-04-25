const INDIA_TIME_ZONE = "Asia/Kolkata";

export function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function hourInIndia() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: INDIA_TIME_ZONE,
      hour: "2-digit",
      hour12: false
    }).format(new Date())
  );
}

export function canExportReport(orderDate: string) {
  const today = todayInIndia();
  return orderDate < today || (orderDate === today && hourInIndia() >= 21);
}
