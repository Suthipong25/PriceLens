import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerApiClient } from "@/lib/server-api";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = await getServerApiClient();
  const [categoriesRes, productsRes] = await Promise.all([
    api.getCategories(),
    api.getProducts({ categorySlug: slug, sort: "price_asc" }),
  ]);

  const category = categoriesRes.data.find((c) => c.slug === slug);
  if (!category) {
    notFound();
  }

  const subCategories = categoriesRes.data.filter(
    (c) => c.parentId === category.id,
  );
  const products = productsRes.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-700">
          หน้าแรก
        </Link>{" "}
        / <span className="font-semibold text-slate-900">{category.name}</span>
      </nav>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">{category.name}</h1>
        <p className="mt-1 text-xs text-slate-500">
          เปรียบเทียบราคาสินค้าในหมวดหมู่ {category.name} จากร้านค้าชั้นนำในประเทศไทย
        </p>

        {subCategories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {subCategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/categories/${sub.slug}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
              >
                {sub.name} ({sub.productCount})
              </Link>
            ))}
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          ยังไม่มีสินค้าในหมวดหมู่นี้
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
