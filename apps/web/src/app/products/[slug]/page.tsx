import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPriceTHB } from "@pricelens/shared";
import { getServerApiClient } from "@/lib/server-api";
import { ProductDetailInteractive } from "@/components/product-detail-interactive";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const api = await getServerApiClient();
  try {
    const { data: product } = await api.getProductById(slug);
    return {
      title: `เปรียบเทียบราคา ${product.name} (${product.model ?? product.brand.name})`,
      description: `เช็กราคาต่ำสุดของ ${product.name} เปรียบเทียบค่าจัดส่งและดูกราฟประวัติราคาย้อนหลังบน PriceLens Thailand`,
    };
  } catch {
    return { title: "ไม่พบสินค้า | PriceLens Thailand" };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();

  let productData;
  try {
    const [prodRes, offersRes, historyRes] = await Promise.all([
      api.getProductById(slug),
      api.getProductOffers(slug, { sort: "price_asc" }),
      api.getProductHistory(slug, "30d"),
    ]);
    productData = {
      product: prodRes.data,
      offers: offersRes.data,
      history: historyRes.data,
    };
  } catch {
    notFound();
  }

  const { product, offers, history } = productData;

  // SEO Structured Data (JSON-LD Product & AggregateOffer)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.model ?? product.id,
    brand: {
      "@type": "Brand",
      name: product.brand.name,
    },
    description: product.description,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "THB",
      lowPrice: product.priceSummary.lowestProductPrice,
      offerCount: product.priceSummary.offerCount,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-700">
          หน้าแรก
        </Link>{" "}
        /{" "}
        <Link
          href={`/categories/${product.category.slug}`}
          className="hover:text-blue-700"
        >
          {product.category.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/brands/${product.brand.slug}`}
          className="hover:text-blue-700"
        >
          {product.brand.name}
        </Link>{" "}
        / <span className="font-semibold text-slate-900">{product.name}</span>
      </nav>

      {/* Product Canonical Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Product Image Box */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 border border-slate-100">
            <div className="text-center">
              <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                {product.brand.name}
              </span>
              <div className="mt-3 text-base font-bold text-slate-900">
                {product.name}
              </div>
              {product.model && (
                <div className="mt-1 font-mono text-xs text-slate-500">
                  Model: {product.model}
                </div>
              )}
            </div>
          </div>

          {/* Product Metadata & Identifiers */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {product.isDemoData && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    [DEMO DATA]
                  </span>
                )}
                {product.identifiers.map((idItem) => (
                  <span
                    key={`${idItem.type}-${idItem.value}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700"
                  >
                    {idItem.type}: {idItem.value}
                  </span>
                ))}
              </div>

              <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {product.name}
              </h1>

              {product.description && (
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Normalized Attributes Table */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(product.attributes)
                  .filter(([k, v]) => k !== "is_demo" && v !== undefined)
                  .map(([key, val]) => (
                    <span
                      key={key}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800"
                    >
                      <strong className="text-slate-500">{key}:</strong>{" "}
                      {String(val)}
                    </span>
                  ))}
              </div>
            </div>

            {/* Price & Freshness Summary Banner */}
            <div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-3">
              <div>
                <span className="block text-xs font-medium text-slate-600">
                  ราคาสินค้าต่ำสุด
                </span>
                <span className="tabular-nums text-2xl font-extrabold text-blue-700">
                  {formatPriceTHB(product.priceSummary.lowestProductPrice)}
                </span>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600">
                  ราคารวมส่งต่ำสุด (ที่ยืนยันแล้ว)
                </span>
                <span className="tabular-nums text-xl font-bold text-emerald-700">
                  {product.priceSummary.lowestVerifiedTotalPrice
                    ? formatPriceTHB(product.priceSummary.lowestVerifiedTotalPrice)
                    : "ไม่ระบุค่าจัดส่ง"}
                </span>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600">
                  ความสดใหม่ของข้อมูล
                </span>
                <span className="tabular-nums text-xs font-semibold text-slate-900">
                  ตรวจสอบล่าสุด:{" "}
                  {new Date(product.priceSummary.lastCheckedAt).toLocaleString(
                    "th-TH",
                  )}
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  มีสินค้าพร้อมส่ง {product.priceSummary.inStockOfferCount ?? 0} จาก{" "}
                  {product.priceSummary.offerCount} ร้านค้า
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Comparison Table, Watchlist/Alerts & Price History */}
      <ProductDetailInteractive
        product={product}
        initialOffers={offers}
        initialHistory={history}
      />

      {/* Related Product Suggestions */}
      {product.suggestions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">
            สินค้าใกล้เคียงในหมวดหมู่เดียวกัน (แยกตามรุ่นย่อย/ความจุชัดเจน)
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {product.suggestions.map((sug) => (
              <Link
                key={sug.id}
                href={`/products/${sug.slug}`}
                className="ui-interactive rounded-xl border border-slate-200 p-4 hover:border-blue-400"
              >
                <div className="text-xs font-semibold text-slate-900">
                  {sug.name}
                </div>
                {sug.model && (
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    Model: {sug.model}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
