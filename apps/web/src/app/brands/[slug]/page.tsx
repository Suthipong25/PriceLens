import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerApiClient } from "@/lib/server-api";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();
  const [brandsRes, productsRes] = await Promise.all([
    api.getBrands(),
    api.getProducts({ brandSlug: slug, sort: "price_asc" }),
  ]);

  const brand = brandsRes.data.find((b) => b.slug === slug);
  if (!brand) {
    notFound();
  }

  const products = productsRes.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-700">
          หน้าแรก
        </Link>{" "}
        / <span className="font-semibold text-slate-900">แบรนด์ {brand.name}</span>
      </nav>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            สินค้าแบรนด์ {brand.name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            รวมสินค้า {brand.name} ทั้งหมด {products.length} รุ่นย่อย พร้อมเปรียบเทียบราคาร้านค้าและประวัติราคา
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {brandsRes.data.map((b) => (
            <Link
              key={b.id}
              href={`/brands/${b.slug}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                b.slug === brand.slug
                  ? "bg-blue-700 text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {b.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
