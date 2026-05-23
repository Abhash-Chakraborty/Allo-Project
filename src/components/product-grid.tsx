"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";

import { formatPrice } from "@/lib/format";
import type { ProductDTO } from "@/lib/types";

const PAGE_SIZE = 21;

export function ProductGrid({ products }: { products: ProductDTO[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = products.slice(0, visible);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {shown.map((product, i) => {
          const totalAvailable = product.stock.reduce((s, w) => s + w.available_units, 0);
          const outOfStock = totalAvailable <= 0;
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              whileHover={{ y: -4 }}
            >
              <Link
                href={`/products/${product.id}`}
                className="card flex flex-col p-0 overflow-hidden cursor-pointer rounded-xl group h-full hover:shadow-elevation-3 transition-shadow"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] w-full bg-shade-30 overflow-hidden shrink-0 rounded-lg">
                  {product.image_url && (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col gap-1 px-6 pt-5 pb-2">
                  <p className="text-eyebrow-cap text-shade-40">{product.sku}</p>
                  <h2 className="text-heading-lg line-clamp-1">{product.name}</h2>
                  <p className="text-heading-md tabular-nums text-shade-50">{formatPrice(product.price_cents)}</p>
                  <p className="text-body-md text-shade-60 line-clamp-2 mt-1 min-h-[3rem]">
                    {product.description ?? "—"}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-auto px-6 pb-6 pt-3 flex items-center justify-between gap-4">
                  <span
                    className={`tag ${
                      outOfStock ? "tag-danger" : totalAvailable <= 3 ? "tag-warning" : "tag-mint"
                    }`}
                  >
                    {outOfStock
                      ? "Out of stock"
                      : totalAvailable <= 3
                      ? `Only ${totalAvailable} left`
                      : `${totalAvailable} available`}
                  </span>
                  <span className="text-caption text-shade-50 group-hover:text-ink transition-colors">
                    View →
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Load more */}
      {visible < products.length && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="pill pill-primary"
          >
            Load more ({products.length - visible} remaining)
          </motion.button>
        </motion.div>
      )}
    </>
  );
}
