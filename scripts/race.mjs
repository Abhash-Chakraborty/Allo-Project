#!/usr/bin/env node
// Race test: fire N reserve requests at the same moment for the last stock of one
// product in one warehouse, count who won, then release the winning hold so the
// stock goes back to where it was.
//
//   node scripts/race.mjs [base-url] [requests]
//   node scripts/race.mjs http://localhost:3000 50
//
// SKU defaults to ALO-RUG-01, which the seed stocks with a single unit in mum-01.
// Each request asks for everything that's left, so exactly one can succeed.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const requests = Number(process.argv[3] ?? 50);
const sku = process.env.SKU ?? "ALO-RUG-01";

const { products } = await (await fetch(`${base}/api/products`)).json();
const product = products.find((p) => p.sku === sku);
if (!product) throw new Error(`No product with SKU ${sku}`);

const stock = product.stock
  .filter((s) => s.available_units > 0)
  .sort((a, b) => a.available_units - b.available_units)[0];
if (!stock) throw new Error(`${sku} has no available units left to race for`);

const quantity = stock.available_units;
console.log(
  `${requests} carts → ${product.name} @ ${stock.warehouse.code} (${quantity} available)`,
);

const body = JSON.stringify({
  product_id: product.id,
  warehouse_id: stock.warehouse.id,
  quantity,
  customer_ref: "race-test",
});

const started = performance.now();
const results = await Promise.all(
  Array.from({ length: requests }, async () => {
    const res = await fetch(`${base}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }),
);
const elapsed = Math.round(performance.now() - started);

const tally = new Map();
for (const r of results) {
  const label = `${r.status} ${r.json?.error?.code ?? (r.status === 201 ? "created" : "")}`.trim();
  tally.set(label, (tally.get(label) ?? 0) + 1);
}
for (const [label, count] of [...tally].sort()) {
  console.log(`  ${label.padEnd(24)} × ${count}`);
}
console.log(`  all ${requests} answered in ${elapsed} ms`);

const winners = results.filter((r) => r.status === 201);
for (const w of winners) {
  await fetch(`${base}/api/reservations/${w.json.reservation.id}/release`, {
    method: "POST",
  });
}
console.log(`released ${winners.length} hold(s); ${quantity} unit(s) available again`);

process.exitCode = winners.length === 1 ? 0 : 1;
