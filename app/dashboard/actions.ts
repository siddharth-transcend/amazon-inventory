"use server";

import { revalidatePath } from "next/cache";

// Type definition covering your complete Google Sheets metric criteria
export type FullProductMetricSuite = {
  id: string;
  asin: string;
  name: string;
  brand: string;
  amazonUrl: string;
  upc: string;
  sku: string;
  bqoolGroup: string;
  status: "RESEARCH" | "RFQ" | "PENDING" | "ORDERED" | "CANCELLED" | "ARCHIVED";
  comment: string;
  
  // Sales Volumes
  sales30dFba: number;
  sales30dFbm: number;
  sales30dShopify: number;
  sales30dEbay: number;
  sales7dTotal: number;
  sales14dTotal: number;
  sales30dTotal: number;
  sales90dTotal: number;
  sales2026Total: number;
  sales2025Total: number;

  // Profit Metrics
  profit7d: number;
  profit14d: number;
  profit30d: number;
  profit90d: number;
  profit2026: number;
  profit2025: number;
  roiPercentage: number;

  // Warehouse & Historical Purchases
  daysInWhSinceLastPurchase: number;
  lastPurchasedDate: string;
  lastPurchasedSupplier: string;
  lastPurchasedShopPrice: number;
  lastPurchasedGbpPrice: number;
  lastPurchasedQty: number;
  totalNoOfPurchasesSince2024: number;

  // Price Matrices
  price30dMin: number;
  supplier30dMin: string;
  price90dMin: number;
  supplier90dMin: string;
  price330dMin: number;
  supplier330dMin: string;

  // 10-day Sourcing Split
  sourcingPrice10d: number;
  sourcingSupplier: string;
  phctMinPrice10d: number;
  phctMinSupplier: string;
  phctSecondMinPrice10d: number;
  phctSecondMinSupplier: string;
  abcMinPrice10d: number;
  abcMinSupplier: string;
  ukMinPrice10d: number;
  ukMinSupplier: string;

  // Market Conditions
  noOfSellers: number;
  maCogs: number;
  shopPrice: number;
  supplier: string;
  buyPriceVat: number;
  gbpPrice: number;
  sellPrice: number;
  marketPrice: number;
  profit: number;
  combinedCurrentBsr: number;
  bsr30d: number;
  estimatedSales: number;
  bsr90d: number;
  variation365: string;
  dayBsrAllConnection: string;
  orderedB2b: boolean;

  // User Editable Operational Fields
  orderQty: number;
  orderedPrice: number;
};

// Global in-memory variable to allow real-time client edits during prototyping
let mockDatabase: FullProductMetricSuite[] = [
  {
    id: "1",
    asin: "B08N5WRWNW",
    name: "Wireless Bluetooth Earbuds Pro",
    brand: "SoundWave",
    amazonUrl: "https://amazon.com/dp/B08N5WRWNW",
    upc: "197644032115",
    sku: "SW-EAR-PRO-BLACK",
    bqoolGroup: "Group Alpha",
    status: "RFQ",
    comment: "Awaiting supplier holiday price sheet confirmation",
    sales30dFba: 120, sales30dFbm: 15, sales30dShopify: 45, sales30dEbay: 10,
    sales7dTotal: 45, sales14dTotal: 92, sales30dTotal: 190, sales90dTotal: 540,
    sales2026Total: 840, sales2025Total: 2100,
    profit7d: 315, profit14d: 644, profit30d: 1330, profit90d: 3780,
    profit2026: 5880, profit2025: 14700, roiPercentage: 38.5,
    daysInWhSinceLastPurchase: 14,
    lastPurchasedDate: "2026-04-20",
    lastPurchasedSupplier: "PHCT",
    lastPurchasedShopPrice: 22.50,
    lastPurchasedGbpPrice: 18.20,
    lastPurchasedQty: 250,
    totalNoOfPurchasesSince2024: 18,
    price30dMin: 21.00, supplier30dMin: "ABC",
    price90dMin: 19.50, supplier90dMin: "PHCT",
    price330dMin: 18.00, supplier330dMin: "UK Main",
    sourcingPrice10d: 22.00, sourcingSupplier: "PHCT",
    phctMinPrice10d: 21.50, phctMinSupplier: "PHCT-A",
    phctSecondMinPrice10d: 22.10, phctSecondMinSupplier: "PHCT-B",
    abcMinPrice10d: 23.00, abcMinSupplier: "ABC-Bulk",
    ukMinPrice10d: 24.50, ukMinSupplier: "UK-Express",
    noOfSellers: 8, maCogs: 18.50, shopPrice: 22.50, supplier: "PHCT",
    buyPriceVat: 27.00, gbpPrice: 18.20, sellPrice: 49.99, marketPrice: 51.00,
    profit: 14.50, combinedCurrentBsr: 1200, bsr30d: 1450, estimatedSales: 210,
    bsr90d: 1100, variation365: "Standard Black", dayBsrAllConnection: "Stable",
    orderedB2b: true,
    orderQty: 150,
    orderedPrice: 21.50
  },
  {
    id: "2",
    asin: "B09V3KXJPB",
    name: "Premium Yoga Mat 6mm",
    brand: "FlexiFit",
    amazonUrl: "https://amazon.com/dp/B09V3KXJPB",
    upc: "742699314552",
    sku: "FF-YOGA-MAT-GRN",
    bqoolGroup: "Group Beta",
    status: "ORDERED",
    comment: "Deposit paid. Vessel tracking updates next Tuesday.",
    sales30dFba: 85, sales30dFbm: 0, sales30dShopify: 12, sales30dEbay: 5,
    sales7dTotal: 22, sales14dTotal: 48, sales30dTotal: 102, sales90dTotal: 310,
    sales2026Total: 490, sales2025Total: 1450,
    profit7d: 110, profit14d: 240, profit30d: 510, profit90d: 1550,
    profit2026: 2450, profit2025: 7250, roiPercentage: 25.0,
    daysInWhSinceLastPurchase: 32,
    lastPurchasedDate: "2026-03-12",
    lastPurchasedSupplier: "ABC",
    lastPurchasedShopPrice: 10.00,
    lastPurchasedGbpPrice: 8.10,
    lastPurchasedQty: 500,
    totalNoOfPurchasesSince2024: 6,
    price30dMin: 10.00, supplier30dMin: "ABC",
    price90dMin: 9.80, supplier90dMin: "ABC",
    price330dMin: 9.20, supplier330dMin: "PHCT",
    sourcingPrice10d: 10.00, sourcingSupplier: "ABC",
    phctMinPrice10d: 10.50, phctMinSupplier: "PHCT-Direct",
    phctSecondMinPrice10d: 11.00, phctSecondMinSupplier: "PHCT-Agent",
    abcMinPrice10d: 9.90, abcMinSupplier: "ABC-Factory",
    ukMinPrice10d: 12.00, ukMinSupplier: "UK-Distro",
    noOfSellers: 4, maCogs: 8.10, shopPrice: 10.00, supplier: "ABC",
    buyPriceVat: 12.00, gbpPrice: 8.10, sellPrice: 24.99, marketPrice: 24.99,
    profit: 6.20, combinedCurrentBsr: 4500, bsr30d: 4200, estimatedSales: 95,
    bsr90d: 4900, variation365: "Eco Green 6mm", dayBsrAllConnection: "Excellent",
    orderedB2b: false,
    orderQty: 300,
    orderedPrice: 10.00
  }
];

export async function getDashboardData() {
  return { 
    products: mockDatabase, 
    uniqueSuppliers: Array.from(new Set(mockDatabase.map(p => p.supplier))) 
  };
}

export async function updateProductOperations(id: string, updates: { orderQty: number; orderedPrice: number; comment: string; status: any }) {
  mockDatabase = mockDatabase.map((product) => {
    if (product.id === id) {
      return {
        ...product,
        orderQty: updates.orderQty,
        orderedPrice: updates.orderedPrice,
        comment: updates.comment,
        status: updates.status,
      };
    }
    return product;
  });
  
  revalidatePath("/dashboard");
  return { success: true };
}