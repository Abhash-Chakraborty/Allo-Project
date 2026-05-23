-- =============================================================================
-- Allo: seed data
-- =============================================================================
-- Idempotent: every insert is keyed on a UNIQUE column (`code` for
-- warehouses, `sku` for products) and uses ON CONFLICT DO NOTHING. The
-- inventory upsert is keyed on (product_id, warehouse_id).
--
-- Re-running this migration on an existing project will not create
-- duplicates and will not stomp on inventory levels that have drifted
-- from seed values; it only fills in missing rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- warehouses
-- ---------------------------------------------------------------------------
insert into public.warehouses (code, name, location) values
  ('blr-01', 'Bengaluru Hub',  'Bengaluru, KA'),
  ('del-01', 'Delhi NCR',      'Gurugram, HR'),
  ('mum-01', 'Mumbai Bandra',  'Mumbai, MH'),
  ('hyd-01', 'Hyderabad Tech', 'Hyderabad, TS')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
insert into public.products (sku, name, description, price_cents, image_url) values
  (
    'ALO-MUG-01',
    'Aloe Stoneware Mug',
    'A 350ml stoneware mug glazed in aloe green. Hand-thrown, dishwasher-safe.',
    149900,
    'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'ALO-CHA-01',
    'Pistachio Lounge Chair',
    'Mid-century lounge chair upholstered in a soft pistachio bouclé. Solid oak frame.',
    8499000,
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'ALO-LMP-01',
    'Studio Arc Lamp',
    'Brushed-steel arc floor lamp with a linen drum shade. Dimmable, E27 bulb included.',
    1299900,
    'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'ALO-RUG-01',
    'Hand-knotted Wool Rug 6×9',
    'Hand-knotted New Zealand wool rug in cream and ivory. 6×9 ft.',
    4899900,
    'https://images.unsplash.com/photo-1600166898405-da9535204843?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'ALO-VAS-01',
    'Travertine Vase Set',
    'Set of three minimal travertine vases in graduated heights. Each vase is unique.',
    899900,
    'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'ALO-BLK-01',
    'Throw Blanket — Aloe',
    'Soft 100% merino wool throw, 130×180cm. Subtle ribbed weave in aloe green.',
    349900,
    'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80'
  )
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------------
-- inventory: stock per (product, warehouse)
-- ---------------------------------------------------------------------------
-- Mug — broad availability
insert into public.inventory (product_id, warehouse_id, total_units)
  select p.id, w.id, v.total
    from public.products p
    join public.warehouses w on w.code in ('blr-01', 'del-01', 'mum-01', 'hyd-01')
    join (values ('blr-01', 24), ('del-01', 18), ('mum-01', 12), ('hyd-01', 8)) as v(code, total)
      on v.code = w.code
   where p.sku = 'ALO-MUG-01'
on conflict (product_id, warehouse_id) do nothing;

-- Lounge chair — limited
insert into public.inventory (product_id, warehouse_id, total_units)
  select p.id, w.id, v.total
    from public.products p
    join public.warehouses w on w.code in ('blr-01', 'del-01', 'mum-01')
    join (values ('blr-01', 3), ('del-01', 2), ('mum-01', 1)) as v(code, total)
      on v.code = w.code
   where p.sku = 'ALO-CHA-01'
on conflict (product_id, warehouse_id) do nothing;

-- Arc lamp
insert into public.inventory (product_id, warehouse_id, total_units)
  select p.id, w.id, v.total
    from public.products p
    join public.warehouses w on w.code in ('blr-01', 'del-01', 'hyd-01')
    join (values ('blr-01', 6), ('del-01', 4), ('hyd-01', 2)) as v(code, total)
      on v.code = w.code
   where p.sku = 'ALO-LMP-01'
on conflict (product_id, warehouse_id) do nothing;

-- Rug — single warehouse, last-piece scenario for concurrency demo
insert into public.inventory (product_id, warehouse_id, total_units)
  select p.id, w.id, v.total
    from public.products p
    join public.warehouses w on w.code in ('mum-01', 'del-01')
    join (values ('mum-01', 1), ('del-01', 2)) as v(code, total)
      on v.code = w.code
   where p.sku = 'ALO-RUG-01'
on conflict (product_id, warehouse_id) do nothing;

-- Vase set
insert into public.inventory (product_id, warehouse_id, total_units)
  select p.id, w.id, v.total
    from public.products p
    join public.warehouses w on w.code in ('blr-01', 'del-01', 'mum-01', 'hyd-01')
    join (values ('blr-01', 10), ('del-01', 7), ('mum-01', 5), ('hyd-01', 3)) as v(code, total)
      on v.code = w.code
   where p.sku = 'ALO-VAS-01'
on conflict (product_id, warehouse_id) do nothing;

-- Throw blanket
insert into public.inventory (product_id, warehouse_id, total_units)
  select p.id, w.id, v.total
    from public.products p
    join public.warehouses w on w.code in ('blr-01', 'del-01', 'mum-01', 'hyd-01')
    join (values ('blr-01', 14), ('del-01', 11), ('mum-01', 9), ('hyd-01', 6)) as v(code, total)
      on v.code = w.code
   where p.sku = 'ALO-BLK-01'
on conflict (product_id, warehouse_id) do nothing;
