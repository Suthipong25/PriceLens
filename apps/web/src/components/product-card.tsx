import React from "react";
import Link from "next/link";
import type { ProductListItem } from "@pricelens/api-client";
import { formatPriceTHB } from "@pricelens/shared";
import { CheckCircle2, Clock, Store } from "lucide-react";

export function ProductCard({ product }: { product: ProductListItem }) {
  const { priceSummary } = product;

  return (
    <article className="ui-interactive flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 hover:shadow-md">
      <div>
        {/* Header Badges */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1.5">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {product.brand.name}
          </span>
          <div className="flex items-center gap-1">
            {product.isDemoData && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                DEMO
              </span>
            )}
            {product.model && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-800">
                {product.model}
              </span>
            )}
          </div>
        </div>

        {/* Product Thumbnail (inner radius = outer 16px - padding 16px -> rounded-xl) */}
        <Link
          href={`/products/${product.slug}`}
          className="mb-3 flex h-40 items-center justify-center rounded-xl bg-slate-50 p-3"
        >
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-800">
              {product.brand.name}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">
              {product.name}
            </div>
          </div>
        </Link>

        {/* Product Title */}
        <h3 className="text-sm font-semibold leading-snug text-slate-900">
          <Link
            href={`/products/${product.slug}`}
            className="hover:text-blue-700"
          >
            {product.name}
          </Link>
        </h3>

        {/* Key Variant Attributes */}
        <div className="mt-2 flex flex-wrap gap-1">
          {product.attributes.storage_capacity && (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700">
              ความจุ: {product.attributes.storage_capacity}
            </span>
          )}
          {product.attributes.ram && (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700">
              RAM: {product.attributes.ram}
            </span>
          )}
          {product.attributes.color && (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700">
              สี: {product.attributes.color}
            </span>
          )}
        </div>
      </div>

      {/* Price & Merchant Comparison Summary */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="block text-[11px] text-slate-500">
              ราคาสินค้าต่ำสุด
            </span>
            <span className="tabular-nums text-lg font-bold text-blue-700">
              {formatPriceTHB(priceSummary.lowestProductPrice)}
            </span>
          </div>

          <div className="text-right">
            <span className="block text-[11px] text-slate-500">
              ราคารวมส่งที่ยืนยันแล้ว
            </span>
            <span className="tabular-nums text-xs font-semibold text-emerald-700">
              {priceSummary.lowestVerifiedTotalPrice
                ? formatPriceTHB(priceSummary.lowestVerifiedTotalPrice)
                : "ไม่ระบุค่าจัดส่ง"}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <Store className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>เปรียบเทียบ {priceSummary.offerCount} ร้านค้า</span>
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-[11px]">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>
              {new Date(priceSummary.lastCheckedAt).toLocaleDateString("th-TH")}
            </span>
          </span>
        </div>

        <Link
          href={`/products/${product.slug}`}
          className="ui-interactive mt-3 flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          ดูเปรียบเทียบราคาและกราฟย้อนหลัง
        </Link>
      </div>
    </article>
  );
}
