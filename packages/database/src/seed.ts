import { eq } from "drizzle-orm";
import type { PriceLensDb } from "./client.js";
import {
  brands,
  categories,
  dataSources,
  ingestionJobs,
  merchants,
  offers,
  priceSnapshots,
  productIdentifiers,
  productMatchCandidates,
  products,
} from "./schema.js";

export const SEED_IDS = {
  categories: {
    electronics: "10000000-0000-4000-8000-000000000001",
    smartphones: "10000000-0000-4000-8000-000000000002",
    laptops: "10000000-0000-4000-8000-000000000003",
    monitors: "10000000-0000-4000-8000-000000000004",
    audio: "10000000-0000-4000-8000-000000000005",
    components: "10000000-0000-4000-8000-000000000006",
  },
  brands: {
    apple: "20000000-0000-4000-8000-000000000001",
    samsung: "20000000-0000-4000-8000-000000000002",
    sony: "20000000-0000-4000-8000-000000000003",
    asus: "20000000-0000-4000-8000-000000000004",
    dell: "20000000-0000-4000-8000-000000000005",
  },
  merchants: {
    bananaIt: "30000000-0000-4000-8000-000000000001",
    adviceIt: "30000000-0000-4000-8000-000000000002",
    jib: "30000000-0000-4000-8000-000000000003",
    powerBuy: "30000000-0000-4000-8000-000000000004",
  },
  sources: {
    csvDemo: "40000000-0000-4000-8000-000000000001",
    merchantFeedDemo: "40000000-0000-4000-8000-000000000002",
    affiliateDemo: "40000000-0000-4000-8000-000000000003",
  },
  products: {
    iphone16Pro256: "50000000-0000-4000-8000-000000000001",
    iphone16Pro512: "50000000-0000-4000-8000-000000000002",
    galaxyS24Ultra256: "50000000-0000-4000-8000-000000000003",
    sonyXm5Black: "50000000-0000-4000-8000-000000000004",
    macbookAirM3_16_512: "50000000-0000-4000-8000-000000000005",
    dellU2723qe: "50000000-0000-4000-8000-000000000006",
  },
  offers: {
    iphone256Banana: "60000000-0000-4000-8000-000000000001",
    iphone256Advice: "60000000-0000-4000-8000-000000000002",
    iphone256Jib: "60000000-0000-4000-8000-000000000003",
    iphone512Banana: "60000000-0000-4000-8000-000000000004",
    s24UltraPowerBuy: "60000000-0000-4000-8000-000000000005",
    s24UltraAdvice: "60000000-0000-4000-8000-000000000006",
    sonyXm5PowerBuy: "60000000-0000-4000-8000-000000000007",
    macbookAirBanana: "60000000-0000-4000-8000-000000000008",
    dellMonitorJib: "60000000-0000-4000-8000-000000000009",
  },
} as const;

export async function seedDatabase(db: PriceLensDb): Promise<void> {
  // 1. Categories
  await db
    .insert(categories)
    .values([
      {
        id: SEED_IDS.categories.electronics,
        parentId: null,
        name: "สินค้าอิเล็กทรอนิกส์และไอที (Electronics & IT)",
        slug: "electronics-it",
      },
      {
        id: SEED_IDS.categories.smartphones,
        parentId: SEED_IDS.categories.electronics,
        name: "สมาร์ทโฟนและแท็บเล็ต (Smartphones & Tablets)",
        slug: "smartphones",
      },
      {
        id: SEED_IDS.categories.laptops,
        parentId: SEED_IDS.categories.electronics,
        name: "โน้ตบุ๊กและคอมพิวเตอร์พกพา (Laptops)",
        slug: "laptops",
      },
      {
        id: SEED_IDS.categories.monitors,
        parentId: SEED_IDS.categories.electronics,
        name: "จอมอนิเตอร์ (Monitors)",
        slug: "monitors",
      },
      {
        id: SEED_IDS.categories.audio,
        parentId: SEED_IDS.categories.electronics,
        name: "หูฟังและเครื่องเสียง (Headphones & Audio)",
        slug: "audio",
      },
      {
        id: SEED_IDS.categories.components,
        parentId: SEED_IDS.categories.electronics,
        name: "อุปกรณ์คอมพิวเตอร์ (PC Components)",
        slug: "pc-components",
      },
    ])
    .onConflictDoNothing();

  // 2. Brands
  await db
    .insert(brands)
    .values([
      { id: SEED_IDS.brands.apple, name: "Apple", slug: "apple" },
      { id: SEED_IDS.brands.samsung, name: "Samsung", slug: "samsung" },
      { id: SEED_IDS.brands.sony, name: "Sony", slug: "sony" },
      { id: SEED_IDS.brands.asus, name: "ASUS", slug: "asus" },
      { id: SEED_IDS.brands.dell, name: "Dell", slug: "dell" },
    ])
    .onConflictDoNothing();

  // 3. Merchants
  await db
    .insert(merchants)
    .values([
      {
        id: SEED_IDS.merchants.bananaIt,
        name: "Banana IT (Demo)",
        slug: "banana-it",
        website: "https://www.bnn.in.th",
        verificationStatus: "verified",
        status: "active",
      },
      {
        id: SEED_IDS.merchants.adviceIt,
        name: "Advice IT (Demo)",
        slug: "advice-it",
        website: "https://www.advice.co.th",
        verificationStatus: "verified",
        status: "active",
      },
      {
        id: SEED_IDS.merchants.jib,
        name: "JIB Computer Group (Demo)",
        slug: "jib",
        website: "https://www.jib.co.th",
        verificationStatus: "verified",
        status: "active",
      },
      {
        id: SEED_IDS.merchants.powerBuy,
        name: "Power Buy (Demo)",
        slug: "power-buy",
        website: "https://www.powerbuy.co.th",
        verificationStatus: "verified",
        status: "active",
      },
    ])
    .onConflictDoNothing();

  // 4. Data Sources
  await db
    .insert(dataSources)
    .values([
      {
        id: SEED_IDS.sources.csvDemo,
        name: "[DEMO DATA] Manual CSV Catalog Import",
        sourceType: "csv",
        configuration: { delimiter: ",", encoding: "utf-8", isDemo: true },
        status: "active",
      },
      {
        id: SEED_IDS.sources.merchantFeedDemo,
        name: "[DEMO DATA] Thai IT Retailer Partner Feed",
        sourceType: "merchant_feed",
        configuration: { format: "json", refreshIntervalMinutes: 60, isDemo: true },
        status: "active",
      },
      {
        id: SEED_IDS.sources.affiliateDemo,
        name: "[DEMO DATA] Regional Affiliate Feed",
        sourceType: "affiliate_api",
        configuration: { secretEnvVarName: "AFFILIATE_FEED_SECRET", isDemo: true },
        status: "active",
      },
    ])
    .onConflictDoNothing();

  // 5. Canonical Products (Explicitly Labeled as [DEMO DATA])
  await db
    .insert(products)
    .values([
      {
        id: SEED_IDS.products.iphone16Pro256,
        categoryId: SEED_IDS.categories.smartphones,
        brandId: SEED_IDS.brands.apple,
        name: "Apple iPhone 16 Pro 256GB Natural Titanium",
        slug: "apple-iphone-16-pro-256gb-natural-titanium",
        model: "MYN13TH/A",
        description:
          "[DEMO DATA] Apple iPhone 16 Pro ความจุ 256GB สีไทเทเนียมธรรมชาติ จอภาพ Super Retina XDR ขนาด 6.3 นิ้ว ชิป A18 Pro",
        imageUrl: "https://placehold.co/600x600/f8fafc/0f172a?text=iPhone+16+Pro+256GB",
        attributes: {
          storage_capacity: "256GB",
          ram: "8GB",
          color: "Natural Titanium",
          size: "6.3-inch",
          condition: "new",
          is_demo: true,
        },
        status: "active",
      },
      {
        id: SEED_IDS.products.iphone16Pro512,
        categoryId: SEED_IDS.categories.smartphones,
        brandId: SEED_IDS.brands.apple,
        name: "Apple iPhone 16 Pro 512GB Natural Titanium",
        slug: "apple-iphone-16-pro-512gb-natural-titanium",
        model: "MYN53TH/A",
        description:
          "[DEMO DATA] Apple iPhone 16 Pro ความจุ 512GB สีไทเทเนียมธรรมชาติ (แยกรุ่นความจุชัดเจนจากรุ่น 256GB)",
        imageUrl: "https://placehold.co/600x600/f8fafc/0f172a?text=iPhone+16+Pro+512GB",
        attributes: {
          storage_capacity: "512GB",
          ram: "8GB",
          color: "Natural Titanium",
          size: "6.3-inch",
          condition: "new",
          is_demo: true,
        },
        status: "active",
      },
      {
        id: SEED_IDS.products.galaxyS24Ultra256,
        categoryId: SEED_IDS.categories.smartphones,
        brandId: SEED_IDS.brands.samsung,
        name: "Samsung Galaxy S24 Ultra 5G (12GB/256GB) Titanium Gray",
        slug: "samsung-galaxy-s24-ultra-12gb-256gb-titanium-gray",
        model: "SM-S928BZTQTHL",
        description:
          "[DEMO DATA] สมาร์ทโฟน Samsung Galaxy S24 Ultra 5G แรม 12GB ความจุ 256GB สี Titanium Gray พร้อมปากกา S-Pen",
        imageUrl: "https://placehold.co/600x600/f8fafc/0f172a?text=Galaxy+S24+Ultra+256GB",
        attributes: {
          storage_capacity: "256GB",
          ram: "12GB",
          color: "Titanium Gray",
          size: "6.8-inch",
          condition: "new",
          is_demo: true,
        },
        status: "active",
      },
      {
        id: SEED_IDS.products.sonyXm5Black,
        categoryId: SEED_IDS.categories.audio,
        brandId: SEED_IDS.brands.sony,
        name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black",
        slug: "sony-wh-1000xm5-black",
        model: "WH-1000XM5/BM",
        description:
          "[DEMO DATA] หูฟังไร้สายตัดเสียงรบกวน Sony WH-1000XM5 สีดำ ประกันศูนย์ไทย",
        imageUrl: "https://placehold.co/600x600/f8fafc/0f172a?text=Sony+WH-1000XM5",
        attributes: {
          color: "Black",
          condition: "new",
          variant: "Wireless Over-Ear",
          is_demo: true,
        },
        status: "active",
      },
      {
        id: SEED_IDS.products.macbookAirM3_16_512,
        categoryId: SEED_IDS.categories.laptops,
        brandId: SEED_IDS.brands.apple,
        name: "Apple MacBook Air 13-inch M3 (16GB RAM / 512GB SSD) Midnight",
        slug: "apple-macbook-air-13-m3-16gb-512gb-midnight",
        model: "MC8Q4TH/A",
        description:
          "[DEMO DATA] MacBook Air 13 นิ้ว ชิป Apple M3 หน่วยความจำ 16GB SSD 512GB คีย์บอร์ดไทย-อังกฤษ สีมิดไนท์",
        imageUrl: "https://placehold.co/600x600/f8fafc/0f172a?text=MacBook+Air+M3+16+512",
        attributes: {
          cpu: "Apple M3",
          ram: "16GB",
          storage_capacity: "512GB",
          color: "Midnight",
          size: "13.6-inch",
          condition: "new",
          is_demo: true,
        },
        status: "active",
      },
      {
        id: SEED_IDS.products.dellU2723qe,
        categoryId: SEED_IDS.categories.monitors,
        brandId: SEED_IDS.brands.dell,
        name: "Dell UltraSharp 27 4K USB-C Hub Monitor (U2723QE)",
        slug: "dell-ultrasharp-27-4k-u2723qe",
        model: "U2723QE",
        description:
          "[DEMO DATA] จอมอนิเตอร์ Dell UltraSharp 27 นิ้ว ความละเอียด 4K UHD IPS Black พร้อม USB-C Hub 90W",
        imageUrl: "https://placehold.co/600x600/f8fafc/0f172a?text=Dell+U2723QE+27+4K",
        attributes: {
          size: "27-inch",
          color: "Silver",
          condition: "new",
          variant: "4K IPS Black USB-C",
          is_demo: true,
        },
        status: "active",
      },
    ])
    .onConflictDoNothing();

  // 6. Product Identifiers
  await db
    .insert(productIdentifiers)
    .values([
      {
        productId: SEED_IDS.products.iphone16Pro256,
        type: "EAN",
        value: "0195949821943",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.iphone16Pro256,
        type: "MPN",
        value: "MYN13TH/A",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.iphone16Pro512,
        type: "EAN",
        value: "0195949822100",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.iphone16Pro512,
        type: "MPN",
        value: "MYN53TH/A",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.galaxyS24Ultra256,
        type: "EAN",
        value: "8806095395579",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.galaxyS24Ultra256,
        type: "MPN",
        value: "SM-S928BZTQTHL",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.sonyXm5Black,
        type: "EAN",
        value: "4548736132603",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.sonyXm5Black,
        type: "MPN",
        value: "WH-1000XM5/BM",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.macbookAirM3_16_512,
        type: "EAN",
        value: "0195949711022",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.macbookAirM3_16_512,
        type: "MPN",
        value: "MC8Q4TH/A",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.dellU2723qe,
        type: "EAN",
        value: "5397184656853",
        sourceId: null,
      },
      {
        productId: SEED_IDS.products.dellU2723qe,
        type: "MPN",
        value: "U2723QE",
        sourceId: null,
      },
    ])
    .onConflictDoNothing();

  // 7. Offers (Demonstrating Free Shipping = 0.00, Paid Shipping = 45.00, and Unknown Shipping = null)
  const now = new Date();
  await db
    .insert(offers)
    .values([
      {
        id: SEED_IDS.offers.iphone256Banana,
        productId: SEED_IDS.products.iphone16Pro256,
        merchantId: SEED_IDS.merchants.bananaIt,
        sourceId: SEED_IDS.sources.merchantFeedDemo,
        externalProductId: "BNN-IP16P-256-NAT",
        title: "Apple iPhone 16 Pro 256GB Natural Titanium (MYN13TH/A)",
        productUrl: "https://www.bnn.in.th/th/p/apple-iphone-16-pro-256gb-natural-titanium-demo",
        affiliateUrl:
          "https://www.bnn.in.th/th/p/apple-iphone-16-pro-256gb-natural-titanium-demo?utm_source=pricelens",
        price: "38900.00",
        currency: "THB",
        shippingCost: "0.00",
        totalPrice: "38900.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.iphone256Advice,
        productId: SEED_IDS.products.iphone16Pro256,
        merchantId: SEED_IDS.merchants.adviceIt,
        sourceId: SEED_IDS.sources.merchantFeedDemo,
        externalProductId: "ADV-IP16P-256-NAT",
        title: "iPhone 16 Pro (256GB) Natural Titanium ประกันศูนย์ไทย",
        productUrl: "https://www.advice.co.th/product/iphone-16-pro-256gb-demo",
        affiliateUrl: null,
        price: "38790.00",
        currency: "THB",
        shippingCost: null, // Unknown shipping -> totalPrice must be null!
        totalPrice: null,
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.iphone256Jib,
        productId: SEED_IDS.products.iphone16Pro256,
        merchantId: SEED_IDS.merchants.jib,
        sourceId: SEED_IDS.sources.csvDemo,
        externalProductId: "JIB-IP16P-256-NAT",
        title: "APPLE IPHONE 16 PRO 256GB - NATURAL TITANIUM",
        productUrl: "https://www.jib.co.th/web/product/readProduct/iphone16pro-256-demo",
        affiliateUrl: null,
        price: "39200.00",
        currency: "THB",
        shippingCost: "45.00",
        totalPrice: "39245.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.iphone512Banana,
        productId: SEED_IDS.products.iphone16Pro512,
        merchantId: SEED_IDS.merchants.bananaIt,
        sourceId: SEED_IDS.sources.merchantFeedDemo,
        externalProductId: "BNN-IP16P-512-NAT",
        title: "Apple iPhone 16 Pro 512GB Natural Titanium (MYN53TH/A)",
        productUrl: "https://www.bnn.in.th/th/p/apple-iphone-16-pro-512gb-natural-titanium-demo",
        affiliateUrl: null,
        price: "46900.00",
        currency: "THB",
        shippingCost: "0.00",
        totalPrice: "46900.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.s24UltraPowerBuy,
        productId: SEED_IDS.products.galaxyS24Ultra256,
        merchantId: SEED_IDS.merchants.powerBuy,
        sourceId: SEED_IDS.sources.affiliateDemo,
        externalProductId: "PWB-S24U-256-GRY",
        title: "SAMSUNG สมาร์ทโฟน Galaxy S24 Ultra (12GB/256GB) สี Titanium Gray",
        productUrl: "https://www.powerbuy.co.th/th/product/samsung-s24-ultra-256gb-demo",
        affiliateUrl:
          "https://www.powerbuy.co.th/th/product/samsung-s24-ultra-256gb-demo?aff=pricelens",
        price: "36900.00",
        currency: "THB",
        shippingCost: "0.00",
        totalPrice: "36900.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.s24UltraAdvice,
        productId: SEED_IDS.products.galaxyS24Ultra256,
        merchantId: SEED_IDS.merchants.adviceIt,
        sourceId: SEED_IDS.sources.merchantFeedDemo,
        externalProductId: "ADV-S24U-256-GRY",
        title: "Samsung Galaxy S24 Ultra 5G (12/256GB) Titanium Gray",
        productUrl: "https://www.advice.co.th/product/samsung-s24-ultra-256-demo",
        affiliateUrl: null,
        price: "37400.00",
        currency: "THB",
        shippingCost: "50.00",
        totalPrice: "37450.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.sonyXm5PowerBuy,
        productId: SEED_IDS.products.sonyXm5Black,
        merchantId: SEED_IDS.merchants.powerBuy,
        sourceId: SEED_IDS.sources.affiliateDemo,
        externalProductId: "PWB-SONY-XM5-BLK",
        title: "SONY หูฟังไร้สายตัดเสียงรบกวน WH-1000XM5 สีดำ",
        productUrl: "https://www.powerbuy.co.th/th/product/sony-wh-1000xm5-black-demo",
        affiliateUrl: null,
        price: "10990.00",
        currency: "THB",
        shippingCost: "0.00",
        totalPrice: "10990.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.macbookAirBanana,
        productId: SEED_IDS.products.macbookAirM3_16_512,
        merchantId: SEED_IDS.merchants.bananaIt,
        sourceId: SEED_IDS.sources.merchantFeedDemo,
        externalProductId: "BNN-MBA13-M3-16-512-MID",
        title: "Apple MacBook Air 13: M3 chip 16GB/512GB Midnight (MC8Q4TH/A)",
        productUrl: "https://www.bnn.in.th/th/p/apple-macbook-air-13-m3-16-512-demo",
        affiliateUrl: null,
        price: "42900.00",
        currency: "THB",
        shippingCost: "0.00",
        totalPrice: "42900.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
      {
        id: SEED_IDS.offers.dellMonitorJib,
        productId: SEED_IDS.products.dellU2723qe,
        merchantId: SEED_IDS.merchants.jib,
        sourceId: SEED_IDS.sources.csvDemo,
        externalProductId: "JIB-DELL-U2723QE",
        title: "MONITOR 27'' DELL ULTRASHARP U2723QE (IPS, 4K, USB-C)",
        productUrl: "https://www.jib.co.th/web/product/readProduct/dell-u2723qe-demo",
        affiliateUrl: null,
        price: "19500.00",
        currency: "THB",
        shippingCost: "0.00",
        totalPrice: "19500.00",
        availabilityStatus: "in_stock",
        condition: "new",
        sourceUpdatedAt: now,
        lastCheckedAt: now,
        status: "active",
      },
    ])
    .onConflictDoNothing();

  // 8. Seed Price Snapshots (Only if none exist yet for the demo offer)
  const existingSnapshots = await db
    .select({ id: priceSnapshots.id })
    .from(priceSnapshots)
    .where(eq(priceSnapshots.offerId, SEED_IDS.offers.iphone256Banana))
    .limit(1);

  if (existingSnapshots.length === 0) {
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    await db.insert(priceSnapshots).values([
      {
        offerId: SEED_IDS.offers.iphone256Banana,
        price: "41900.00",
        shippingCost: "0.00",
        totalPrice: "41900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(28),
      },
      {
        offerId: SEED_IDS.offers.iphone256Banana,
        price: "40900.00",
        shippingCost: "0.00",
        totalPrice: "40900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(21),
      },
      {
        offerId: SEED_IDS.offers.iphone256Banana,
        price: "39900.00",
        shippingCost: "0.00",
        totalPrice: "39900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(14),
      },
      {
        offerId: SEED_IDS.offers.iphone256Banana,
        price: "39500.00",
        shippingCost: "0.00",
        totalPrice: "39500.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(7),
      },
      {
        offerId: SEED_IDS.offers.iphone256Banana,
        price: "38900.00",
        shippingCost: "0.00",
        totalPrice: "38900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: now,
      },
      {
        offerId: SEED_IDS.offers.iphone256Advice,
        price: "39900.00",
        shippingCost: null,
        totalPrice: null,
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(14),
      },
      {
        offerId: SEED_IDS.offers.iphone256Advice,
        price: "38790.00",
        shippingCost: null,
        totalPrice: null,
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: now,
      },
      {
        offerId: SEED_IDS.offers.s24UltraPowerBuy,
        price: "39900.00",
        shippingCost: "0.00",
        totalPrice: "39900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(20),
      },
      {
        offerId: SEED_IDS.offers.s24UltraPowerBuy,
        price: "37900.00",
        shippingCost: "0.00",
        totalPrice: "37900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: daysAgo(10),
      },
      {
        offerId: SEED_IDS.offers.s24UltraPowerBuy,
        price: "36900.00",
        shippingCost: "0.00",
        totalPrice: "36900.00",
        currency: "THB",
        availabilityStatus: "in_stock",
        recordedAt: now,
      },
    ]);
  }

  // 9. Sample Uncertain Match Candidate for Admin Review Queue
  await db
    .insert(productMatchCandidates)
    .values({
      productId: SEED_IDS.products.iphone16Pro256,
      sourceId: SEED_IDS.sources.csvDemo,
      externalProductId: "CSV-UNCERTAIN-IP16P-256",
      candidateData: {
        title: "[DEMO DATA] Apple iPhone 16 Pro 256GB Titanium (ไม่ระบุรหัสโมเดล/EAN)",
        merchantName: "Advice IT (Demo)",
        price: "38850.00",
        currency: "THB",
        shippingCost: null,
        productUrl: "https://www.advice.co.th/product/uncertain-iphone16pro-256-demo",
        attributes: {
          storage_capacity: "256GB",
          color: "Natural Titanium",
          condition: "new",
        },
      },
      confidenceScore: "78.50",
      matchingReasons: [
        "EXACT_BRAND_MATCH:Apple",
        "NORMALIZED_TITLE_SIMILARITY:0.79",
        "VARIANT_STORAGE_MATCH:256GB",
        "MISSING_GTIN_AND_MPN_REQUIRES_ADMIN_REVIEW",
      ],
      reviewStatus: "pending",
    })
    .onConflictDoNothing();

  // 10. Sample Ingestion Job Record
  const existingJobs = await db
    .select({ id: ingestionJobs.id })
    .from(ingestionJobs)
    .limit(1);

  if (existingJobs.length === 0) {
    await db.insert(ingestionJobs).values({
      sourceId: SEED_IDS.sources.csvDemo,
      jobType: "csv_import",
      status: "completed",
      startedAt: new Date(now.getTime() - 5000),
      completedAt: now,
      recordsProcessed: 9,
      recordsFailed: 0,
      errorMessage: null,
    });
  }
}
