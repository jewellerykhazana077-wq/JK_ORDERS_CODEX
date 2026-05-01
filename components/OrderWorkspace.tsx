"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "./Header";
import ThemedSelect from "./ThemedSelect";
import { ITEM_STATUSES, ORDER_STATUSES, STATUS_LABELS, type ItemStatus, type OrderStatus } from "@/lib/status";
import type { SessionUser } from "@/lib/types";

type ProductItem = {
  id?: string;
  productImageUrl: string;
  status: ItemStatus;
  awbNumber: string;
  employeeRemark?: string;
};

type OrderRow = {
  _id: string;
  orderDate: string;
  orderNumber: string;
  productImageUrl: string;
  lineItems: ProductItem[];
  paymentType?: "Prepaid" | "COD";
  status: OrderStatus;
  awbNumber: string;
  employeeRemark: string;
  createdByName: string;
  updatedAt: string;
};

type Totals = Record<OrderStatus, number> & { total: number };
type MonthlyTotals = Totals & { payments: { Prepaid: number; COD: number } };
type OrderForm = {
  orderDate: string;
  orderNumber: string;
  paymentType: "Prepaid" | "COD";
  products: ProductItem[];
};

const ITEM_STATUS_OPTIONS = ITEM_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status]
}));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth() {
  return today().slice(0, 7);
}

function daysFromOrder(orderDate: string) {
  const order = new Date(`${orderDate}T00:00:00`);
  const current = new Date(`${today()}T00:00:00`);
  return Math.floor((current.getTime() - order.getTime()) / 86400000);
}

function delayTag(orderDate: string) {
  const days = daysFromOrder(orderDate);
  if (days >= 7) return { label: "Delayed more than 7 days", tone: "red" };
  if (days >= 4) return { label: "Delayed more than 4 days", tone: "amber" };
  return null;
}

export default function OrderWorkspace({ user }: { user: SessionUser }) {
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<OrderRow[]>([]);
  const [totals, setTotals] = useState<Totals>(() => ({ total: 0, ...Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) } as Totals));
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotals | null>(null);
  const [dailyFilter, setDailyFilter] = useState<OrderStatus | "All">("All");
  const [monthlyFilter, setMonthlyFilter] = useState<OrderStatus | "All" | "Prepaid" | "COD">("All");
  const [loading, setLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderForm>({
    orderDate: today(),
    orderNumber: "",
    paymentType: "Prepaid" as "Prepaid" | "COD",
    products: [{ productImageUrl: "", status: "Unprocessed" as ItemStatus, awbNumber: "" }]
  });
  const canEditSavedOrders = user.role === "admin" || Boolean(user.canEditOrders);

  const summaryCards = useMemo(
    () => [
      ["Total orders", totals.total],
      ["Unprocessed", totals.Unprocessed],
      ["Processing", totals["Processing already"]],
      ["Not in color", totals["Not dispatched due to not in color"]],
      ["Raw material shortage", totals["Not dispatched due to raw material not in stock"]],
      ["Dispatched", totals.Dispatched]
    ],
    [totals]
  );

  const filteredRows = useMemo(
    () => (dailyFilter === "All" ? rows : rows.filter((row) => row.status === dailyFilter)),
    [dailyFilter, rows]
  );

  const filteredMonthlyRows = useMemo(() => {
    if (monthlyFilter === "All") return monthlyRows;
    if (monthlyFilter === "Prepaid" || monthlyFilter === "COD") {
      return monthlyRows.filter((row) => row.paymentType === monthlyFilter);
    }
    return monthlyRows.filter((row) => row.status === monthlyFilter);
  }, [monthlyFilter, monthlyRows]);

  async function loadOrders(selectedDate = date) {
    setLoading(true);
    const response = await fetch(`/api/orders?date=${selectedDate}`);
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error ?? "Could not load orders.");
      return;
    }
    setRows(data.rows);
    setTotals(data.totals);
    setDailyFilter("All");
  }

  async function loadMonthly(selectedMonth = month) {
    setMonthlyLoading(true);
    const response = await fetch(`/api/orders/monthly?month=${selectedMonth}`);
    const data = await response.json();
    setMonthlyLoading(false);
    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error ?? "Could not load monthly report.");
      return;
    }
    setMonthlyTotals(data.totals);
    setMonthlyRows(data.rows ?? []);
    setMonthlyFilter("All");
  }

  useEffect(() => {
    loadOrders(date);
  }, [date]);

  useEffect(() => {
    loadMonthly(month);
  }, [month]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/orders", {
      method: editingOrderId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingOrderId ? { ...form, id: editingOrderId } : form)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error ?? (editingOrderId ? "Could not update order." : "Could not save order."));
      return;
    }
    setMessageType("success");
    setMessage(editingOrderId ? "Order updated." : "Order saved.");
    setEditingOrderId(null);
    setForm({
      ...form,
      orderNumber: "",
      paymentType: "Prepaid",
      products: [{ productImageUrl: "", status: "Unprocessed", awbNumber: "" }]
    });
    setDate(form.orderDate);
    await loadOrders(form.orderDate);
    await loadMonthly(form.orderDate.slice(0, 7));
  }

  async function updateStatus(row: OrderRow, item: ProductItem, status: ItemStatus, awbNumber = item.awbNumber) {
    setMessage("");
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row._id, itemId: item.id, status, awbNumber })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error ?? "Could not update status.");
      return;
    }
    setMessageType("success");
    setMessage(status === "Dispatched" ? "AWB number saved." : "Status updated.");
    await loadOrders();
    await loadMonthly();
  }

  async function handleLineStatusChange(row: OrderRow, item: ProductItem, status: ItemStatus) {
    if (status === "Dispatched") {
      const awbNumber = window.prompt(`Enter AWB number for order ${row.orderNumber}`, row.awbNumber ?? "");
      if (!awbNumber?.trim()) {
        setMessageType("error");
        setMessage("AWB number is required when status is Dispatched.");
        return;
      }
      await updateStatus(row, item, status, awbNumber.trim());
      return;
    }
    await updateStatus(row, item, status, "");
  }

  async function deleteOrder(row: OrderRow) {
    if (user.role !== "admin") return;
    const confirmed = window.confirm(`Delete order ${row.orderNumber}? This cannot be undone.`);
    if (!confirmed) return;

    setMessage("");
    const response = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row._id })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error ?? "Could not delete order.");
      return;
    }

    setMessageType("success");
    setMessage(`Order ${row.orderNumber} deleted.`);
    await loadOrders();
    await loadMonthly();
  }

  function updateProduct(index: number, product: ProductItem) {
    setForm({
      ...form,
      products: form.products.map((item, itemIndex) => (itemIndex === index ? product : item))
    });
  }

  function addProduct() {
    setForm({
      ...form,
      products: [...form.products, { productImageUrl: "", status: "Unprocessed", awbNumber: "" }]
    });
  }

  function removeProduct(index: number) {
    if (form.products.length === 1) return;
    setForm({ ...form, products: form.products.filter((_, itemIndex) => itemIndex !== index) });
  }

  function startEditOrder(row: OrderRow) {
    if (!canEditSavedOrders) return;
    setMessage("");
    setEditingOrderId(row._id);
    setForm({
      orderDate: row.orderDate,
      orderNumber: row.orderNumber,
      paymentType: row.paymentType ?? "Prepaid",
      products: (row.lineItems?.length ? row.lineItems : [{ productImageUrl: row.productImageUrl, status: row.status as ItemStatus, awbNumber: row.awbNumber }]).map((item) => ({
        id: item.id,
        productImageUrl: item.productImageUrl,
        status: item.status,
        awbNumber: item.awbNumber ?? ""
      }))
    });
    setDate(row.orderDate);
    setMonth(row.orderDate.slice(0, 7));
  }

  function cancelEditOrder() {
    setEditingOrderId(null);
    setForm({
      orderDate: today(),
      orderNumber: "",
      paymentType: "Prepaid",
      products: [{ productImageUrl: "", status: "Unprocessed", awbNumber: "" }]
    });
  }

  function exportUrl() {
    window.location.href = `/api/orders/export?date=${date}`;
  }

  function monthlyExportUrl() {
    window.location.href = `/api/orders/export?month=${month}`;
  }

  return (
    <>
      <Header user={user} />
      <main className="page">
        <section className="toolbar">
          <label>
            View date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          {user.role === "admin" ? <button className="secondary" onClick={exportUrl}>Generate Excel</button> : null}
        </section>

        <section className="stats-grid">
          {summaryCards.map(([label, value]) => (
            <button
              className={`stat clickable-stat ${dailyFilter === (label === "Total orders" ? "All" : labelToStatus(label as string)) ? "active" : ""}`}
              key={label}
              type="button"
              onClick={() => setDailyFilter(label === "Total orders" ? "All" : labelToStatus(label as string))}
            >
              <span>{label}</span>
              <strong>{value}</strong>
            </button>
          ))}
        </section>

        <section className="workspace-grid">
          <form className="panel" onSubmit={submit}>
            <h2>{editingOrderId ? "Edit order" : "Record order"}</h2>
            <label>
              Order date
              <input type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} required />
            </label>
            <label>
              Order number
              <input value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} required />
            </label>
            <div className="product-editor">
              <div className="section-header compact">
                <h3>Products</h3>
                <button className="mini-button" type="button" onClick={addProduct}>Add product</button>
              </div>
              {form.products.map((product, index) => (
                <div className="product-edit-row" key={index}>
                  <label>
                    Product image hyperlink
                    <input
                      type="url"
                      value={product.productImageUrl}
                      onChange={(event) => updateProduct(index, { ...product, productImageUrl: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Product status
                    <ThemedSelect
                      value={product.status}
                      onChange={(status) => updateProduct(index, { ...product, status, awbNumber: "" })}
                      options={ITEM_STATUS_OPTIONS}
                      label="Product status"
                    />
                  </label>
                  {product.status === "Dispatched" ? (
                    <label>
                      AWB number
                      <input
                        value={product.awbNumber}
                        onChange={(event) => updateProduct(index, { ...product, awbNumber: event.target.value })}
                        required
                      />
                    </label>
                  ) : null}
                  {form.products.length > 1 ? (
                    <button className="mini-button danger-button" type="button" onClick={() => removeProduct(index)}>Remove</button>
                  ) : null}
                </div>
              ))}
            </div>
            <fieldset className="radio-group">
              <legend>Payment type</legend>
              <label>
                <input
                  type="radio"
                  name="paymentType"
                  checked={form.paymentType === "Prepaid"}
                  onChange={() => setForm({ ...form, paymentType: "Prepaid" })}
                />
                Prepaid
              </label>
              <label>
                <input
                  type="radio"
                  name="paymentType"
                  checked={form.paymentType === "COD"}
                  onChange={() => setForm({ ...form, paymentType: "COD" })}
                />
                COD
              </label>
            </fieldset>
            {message ? <p className={messageType === "error" ? "error" : "notice"}>{message}</p> : null}
            <div className="form-actions">
              {editingOrderId ? <button className="ghost" type="button" onClick={cancelEditOrder}>Cancel edit</button> : null}
              <button className="primary">{editingOrderId ? "Update order" : "Save order"}</button>
            </div>
          </form>

          <section className="panel table-panel">
            <div className="section-header compact">
              <h2>{dailyFilter === "All" ? `Orders for ${date}` : `${STATUS_LABELS[dailyFilter]} orders for ${date}`}</h2>
              {dailyFilter !== "All" ? <button className="mini-button" type="button" onClick={() => setDailyFilter("All")}>Clear filter</button> : null}
            </div>
            {loading ? <p>Loading orders...</p> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Products</th>
                    <th>Order status</th>
                    <th>Delay</th>
                    <th>Payment</th>
                    <th>Remark</th>
                    <th>Employee</th>
                    {user.role === "admin" || canEditSavedOrders ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row._id} className={delayTag(row.orderDate)?.tone === "red" ? "row-late-red" : delayTag(row.orderDate)?.tone === "amber" ? "row-late-amber" : ""}>
                      <td>{row.orderNumber}</td>
                      <td className="line-items-cell">
                        {(row.lineItems?.length ? row.lineItems : [{ productImageUrl: row.productImageUrl, status: row.status as ItemStatus, awbNumber: row.awbNumber }]).map((item, index) => (
                          <div className="line-item-row" key={item.id ?? index}>
                            <a href={item.productImageUrl} target="_blank" className="thumb-link">
                              <img src={item.productImageUrl} alt={`Product ${index + 1} for order ${row.orderNumber}`} />
                            </a>
                            <ThemedSelect
                              value={item.status}
                              onChange={(status) => handleLineStatusChange(row, item, status)}
                              options={ITEM_STATUS_OPTIONS}
                              label={`Product status for order ${row.orderNumber}`}
                            />
                            {item.status === "Dispatched" ? (
                              <div className="awb-cell">
                                <input
                                  className="compact-input"
                                  defaultValue={item.awbNumber}
                                  placeholder="AWB"
                                  onBlur={(event) => updateStatus(row, item, "Dispatched", event.target.value)}
                                />
                                <button className="mini-button" type="button" onClick={() => handleLineStatusChange(row, item, "Dispatched")}>Edit</button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </td>
                      <td><span className="status-badge">{STATUS_LABELS[row.status]}</span></td>
                      <td>
                        {delayTag(row.orderDate) ? (
                          <span className={`delay-badge ${delayTag(row.orderDate)?.tone}`}>{delayTag(row.orderDate)?.label}</span>
                        ) : "-"}
                      </td>
                      <td>{row.paymentType ?? "-"}</td>
                      <td>
                        <span className="remark-text" title={row.employeeRemark || ""}>{row.employeeRemark || "-"}</span>
                      </td>
                      <td>{row.createdByName}</td>
                      {user.role === "admin" || canEditSavedOrders ? (
                        <td>
                          <div className="row-actions">
                            {canEditSavedOrders ? <button className="mini-button" type="button" onClick={() => startEditOrder(row)}>Edit</button> : null}
                            {user.role === "admin" ? <button className="mini-button danger-button" type="button" onClick={() => deleteOrder(row)}>Delete</button> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!filteredRows.length && !loading ? (
                    <tr><td colSpan={user.role === "admin" || canEditSavedOrders ? 8 : 7}>No orders recorded for this date.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section className="panel monthly-panel">
          <div className="section-header">
            <h2>Monthly report</h2>
            <div className="month-actions">
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              {user.role === "admin" ? <button className="secondary" onClick={monthlyExportUrl}>Monthly Excel</button> : null}
            </div>
          </div>
          {monthlyLoading ? <p>Loading monthly report...</p> : null}
          {monthlyTotals ? (
            <div className="monthly-grid">
              <button className={`stat clickable-stat ${monthlyFilter === "All" ? "active" : ""}`} type="button" onClick={() => setMonthlyFilter("All")}><span>Total orders</span><strong>{monthlyTotals.total}</strong></button>
              {ORDER_STATUSES.map((status) => (
                <button className={`stat clickable-stat ${monthlyFilter === status ? "active" : ""}`} type="button" onClick={() => setMonthlyFilter(status)} key={status}><span>{STATUS_LABELS[status]}</span><strong>{monthlyTotals[status]}</strong></button>
              ))}
              <button className={`stat clickable-stat ${monthlyFilter === "Prepaid" ? "active" : ""}`} type="button" onClick={() => setMonthlyFilter("Prepaid")}><span>Prepaid</span><strong>{monthlyTotals.payments.Prepaid}</strong></button>
              <button className={`stat clickable-stat ${monthlyFilter === "COD" ? "active" : ""}`} type="button" onClick={() => setMonthlyFilter("COD")}><span>COD</span><strong>{monthlyTotals.payments.COD}</strong></button>
            </div>
          ) : null}
          <div className="monthly-list">
            <div className="section-header compact">
              <h3>{monthlyFilter === "All" ? "Monthly order list" : `Monthly list: ${monthlyFilter in STATUS_LABELS ? STATUS_LABELS[monthlyFilter as OrderStatus] : monthlyFilter}`}</h3>
              {monthlyFilter !== "All" ? <button className="mini-button" type="button" onClick={() => setMonthlyFilter("All")}>Clear filter</button> : null}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Products</th>
                    {user.role === "admin" || canEditSavedOrders ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyRows.map((row) => (
                    <tr key={row._id}>
                      <td>{row.orderDate}</td>
                      <td>{row.orderNumber}</td>
                      <td><span className="status-badge">{STATUS_LABELS[row.status]}</span></td>
                      <td>{row.paymentType ?? "-"}</td>
                      <td>{row.lineItems?.length ?? 1}</td>
                      {user.role === "admin" || canEditSavedOrders ? (
                        <td>
                          <div className="row-actions">
                            {canEditSavedOrders ? <button className="mini-button" type="button" onClick={() => startEditOrder(row)}>Edit</button> : null}
                            {user.role === "admin" ? <button className="mini-button danger-button" type="button" onClick={() => deleteOrder(row)}>Delete</button> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!filteredMonthlyRows.length ? <tr><td colSpan={user.role === "admin" || canEditSavedOrders ? 6 : 5}>No orders in this filter.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function labelToStatus(label: string): OrderStatus {
  if (label === "Processing") return "Processing already";
  if (label === "Not in color") return "Not dispatched due to not in color";
  if (label === "Raw material shortage") return "Not dispatched due to raw material not in stock";
  return label as OrderStatus;
}
