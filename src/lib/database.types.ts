/**
 * Hand-rolled Supabase type definitions for the Allo schema.
 *
 * These mirror what `supabase gen types typescript` would emit, so the
 * client is fully typed without needing a live Supabase project at
 * compile time. If the schema changes, regenerate with:
 *
 *   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "released"
  | "expired";

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          price_cents: number;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          description?: string | null;
          price_cents: number;
          image_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      warehouses: {
        Row: {
          id: string;
          code: string;
          name: string;
          location: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          location?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouses"]["Insert"]>;
        Relationships: [];
      };
      inventory: {
        Row: {
          id: string;
          product_id: string;
          warehouse_id: string;
          total_units: number;
          reserved_units: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          warehouse_id: string;
          total_units?: number;
          reserved_units?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory"]["Insert"]>;
        Relationships: [];
      };
      reservations: {
        Row: {
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
        };
        Insert: {
          id?: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          status?: ReservationStatus;
          expires_at: string;
          created_at?: string;
          confirmed_at?: string | null;
          released_at?: string | null;
          expired_at?: string | null;
          customer_ref?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          key: string;
          endpoint: string;
          request_hash: string;
          status_code: number;
          response_body: Json;
          created_at: string;
        };
        Insert: {
          key: string;
          endpoint: string;
          request_hash: string;
          status_code: number;
          response_body: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["idempotency_keys"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      inventory_with_available: {
        Row: {
          id: string;
          product_id: string;
          warehouse_id: string;
          total_units: number;
          reserved_units: number;
          available_units: number;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      reserve_units: {
        Args: {
          p_product_id: string;
          p_warehouse_id: string;
          p_quantity: number;
          p_ttl_seconds: number;
          p_customer_ref?: string | null;
        };
        Returns: Database["public"]["Tables"]["reservations"]["Row"];
      };
      confirm_reservation: {
        Args: { p_id: string };
        Returns: Database["public"]["Tables"]["reservations"]["Row"];
      };
      release_reservation: {
        Args: { p_id: string };
        Returns: Database["public"]["Tables"]["reservations"]["Row"];
      };
      expire_reservations: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      reservation_status: ReservationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
