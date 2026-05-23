import "server-only";

import {
  ApiError,
  apiErrorFromPgError,
} from "@/lib/api-error";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  InventoryAvailableRow,
  ProductDTO,
  ReservationDTO,
  ReservationRow,
  WarehouseDTO,
  WarehouseStockDTO,
} from "@/lib/types";

/**
 * Server-only data-access helpers. These wrap Supabase calls with our
 * error mapping and do the per-DTO shaping the API routes return.
 */

export function toReservationDTO(row: ReservationRow): ReservationDTO {
  return {
    id: row.id,
    product_id: row.product_id,
    warehouse_id: row.warehouse_id,
    quantity: row.quantity,
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    confirmed_at: row.confirmed_at,
    released_at: row.released_at,
    expired_at: row.expired_at,
    customer_ref: row.customer_ref,
  };
}

/**
 * Fetch every product, every warehouse, and the inventory for both,
 * shaped into ProductDTO[] with `stock` per warehouse.
 *
 * Three queries, joined in memory: avoids the PostgREST embedding
 * complexity for what is a small dataset.
 */
export async function listProducts(): Promise<ProductDTO[]> {
  const supabase = getSupabaseAdmin();

  const [products, warehouses, inventory] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("warehouses").select("*").order("code"),
    supabase
      .from("inventory_with_available")
      .select("*")
      .returns<InventoryAvailableRow[]>(),
  ]);

  if (products.error) throw apiErrorFromPgError(products.error);
  if (warehouses.error) throw apiErrorFromPgError(warehouses.error);
  if (inventory.error) throw apiErrorFromPgError(inventory.error);

  const warehouseById = new Map(
    (warehouses.data ?? []).map((w) => [w.id, w]),
  );

  const stockByProduct = new Map<string, WarehouseStockDTO[]>();
  for (const inv of inventory.data ?? []) {
    const warehouse = warehouseById.get(inv.warehouse_id);
    if (!warehouse) continue;
    const arr = stockByProduct.get(inv.product_id) ?? [];
    arr.push({
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        location: warehouse.location,
      },
      total_units: inv.total_units,
      reserved_units: inv.reserved_units,
      available_units: inv.available_units,
    });
    stockByProduct.set(inv.product_id, arr);
  }

  return (products.data ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    price_cents: p.price_cents,
    image_url: p.image_url,
    stock: (stockByProduct.get(p.id) ?? []).sort((a, b) =>
      a.warehouse.code.localeCompare(b.warehouse.code),
    ),
  }));
}

export async function listWarehouses(): Promise<WarehouseDTO[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, code, name, location")
    .order("code");
  if (error) throw apiErrorFromPgError(error);
  return data ?? [];
}

export async function getProductById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw apiErrorFromPgError(error);
  return data;
}

/**
 * Fetch a single product with full stock info, shaped as ProductDTO.
 */
export async function getProductWithStock(id: string): Promise<ProductDTO | null> {
  const supabase = getSupabaseAdmin();

  const [product, warehouses, inventory] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("warehouses").select("*").order("code"),
    supabase
      .from("inventory_with_available")
      .select("*")
      .eq("product_id", id)
      .returns<InventoryAvailableRow[]>(),
  ]);

  if (product.error) throw apiErrorFromPgError(product.error);
  if (!product.data) return null;
  if (warehouses.error) throw apiErrorFromPgError(warehouses.error);
  if (inventory.error) throw apiErrorFromPgError(inventory.error);

  const warehouseById = new Map(
    (warehouses.data ?? []).map((w) => [w.id, w]),
  );

  const stock: WarehouseStockDTO[] = (inventory.data ?? [])
    .map((inv) => {
      const warehouse = warehouseById.get(inv.warehouse_id);
      if (!warehouse) return null;
      return {
        warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name, location: warehouse.location },
        total_units: inv.total_units,
        reserved_units: inv.reserved_units,
        available_units: inv.available_units,
      };
    })
    .filter((s): s is WarehouseStockDTO => s !== null)
    .sort((a, b) => a.warehouse.code.localeCompare(b.warehouse.code));

  const p = product.data;
  return { id: p.id, sku: p.sku, name: p.name, description: p.description, price_cents: p.price_cents, image_url: p.image_url, stock };
}

export async function getWarehouseById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, code, name, location")
    .eq("id", id)
    .maybeSingle();
  if (error) throw apiErrorFromPgError(error);
  return data;
}

/**
 * Fetch a reservation by id. If the reservation is `pending` but the
 * `expires_at` has passed, run a single best-effort `expire_reservations()`
 * call to release units and flip its status — *lazy cleanup* as a
 * safety net in case the cron is delayed or off.
 */
export async function getReservation(id: string): Promise<ReservationDTO> {
  const supabase = getSupabaseAdmin();
  const fetchOnce = async () =>
    supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

  const first = await fetchOnce();
  if (first.error) throw apiErrorFromPgError(first.error);
  if (!first.data) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: "Reservation not found.",
    });
  }

  const row = first.data;
  const expiredButPending =
    row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now();

  if (!expiredButPending) return toReservationDTO(row);

  // Best-effort lazy expiry. Errors here are non-fatal — the cron will
  // catch up. We swallow the error and re-fetch.
  try {
    await supabase.rpc("expire_reservations").throwOnError();
  } catch (lazyErr) {
    console.warn("[lazy-expire] failed:", lazyErr);
  }

  const second = await fetchOnce();
  if (second.error) throw apiErrorFromPgError(second.error);
  if (!second.data) {
    throw new ApiError({
      status: 404,
      code: "not_found",
      message: "Reservation not found.",
    });
  }
  return toReservationDTO(second.data);
}
