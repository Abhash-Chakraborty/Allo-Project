import type { Database, ReservationStatus } from "@/lib/database.types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];
export type ReservationRow =
  Database["public"]["Tables"]["reservations"]["Row"];
export type InventoryAvailableRow =
  Database["public"]["Views"]["inventory_with_available"]["Row"];

/** Public-facing DTOs returned by the API. We keep these stable even if
 *  the underlying schema gains private columns. */

export interface WarehouseDTO {
  id: string;
  code: string;
  name: string;
  location: string | null;
}

export interface WarehouseStockDTO {
  warehouse: WarehouseDTO;
  total_units: number;
  reserved_units: number;
  available_units: number;
}

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  stock: WarehouseStockDTO[];
}

export interface ReservationDTO {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  status: ReservationStatus;
  expires_at: string;
  created_at: string;
  confirmed_at: string | null;
  released_at: string | null;
  expired_at: string | null;
  customer_ref: string | null;
}

export type { ReservationStatus };
