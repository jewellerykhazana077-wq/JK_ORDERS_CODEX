import type { ObjectId } from "mongodb";
import type { ItemStatus, OrderStatus } from "./status";

export type UserRole = "admin" | "employee";

export interface UserDocument {
  _id?: ObjectId;
  name: string;
  email?: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDocument {
  _id?: ObjectId;
  orderDate: string;
  orderNumber: string;
  productImageUrl: string;
  lineItems?: OrderLineItem[];
  paymentType: "Prepaid" | "COD";
  status: OrderStatus;
  awbNumber: string;
  employeeRemark: string;
  createdBy: ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderLineItem {
  id: string;
  productImageUrl: string;
  status: ItemStatus;
  awbNumber: string;
  employeeRemark: string;
}

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: UserRole;
}
