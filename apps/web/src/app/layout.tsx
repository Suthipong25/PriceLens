import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { Footer, Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: {
    default: "PriceLens Thailand — ช้อปฉลาด จ่ายน้อยกว่า (Smart Shopping Intelligence)",
    template: "%s | PriceLens Thailand",
  },
  description:
    "แพลตฟอร์มเปรียบเทียบราคาสินค้า ตรวจสอบราคารวมค่าจัดส่ง และติดตามประวัติราคาสินค้าสำหรับตลาดประเทศไทย",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col">
        <AppProviders>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
