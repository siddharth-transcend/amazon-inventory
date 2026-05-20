"use server";

import { google } from "googleapis";
import { revalidatePath } from "next/cache";

export type FullProductMetricSuite = {
  id: string;
  asin: string;
  name: string;
  brand: string;
  amazonUrl: string;
  upc: string;
  sku: string;
  sourceCode: string; 
  bqoolGroup: string;
  status: "NOT REVIEWED" | "NOT SELECTED" | "RESEARCH" | "RFQ" | "PENDING" | "ORDERED" | "CANCELLED" | "ARCHIVED";
  comment: string;
  sourcingDateStr: string;
  
  // Sales Volumes
  sales30dFba: number; sales30dFbm: number; sales30dShopify: number; sales30dEbay: number;
  sales7dTotal: number; sales14dTotal: number; sales30dTotal: number; sales90dTotal: number;
  sales2026Total: number; sales2025Total: number;

  // Profit Metrics
  profit7d: number; profit14d: number; profit30d: number; profit90d: number;
  profit2026: number; profit2025: number; roiPercentage: number;

  // Warehouse nodes
  totalStock: number;
  amazonStock: number;        
  traFba: number;             
  reservedAmz: number;        
  toAmz: number;              
  traAmz: number;             
  sm67ah: number;             
  traB2b: number;             
  traBay: number;             
  webShp: number;             
  traFbm: number;             
  toWhStock: number;          
  
  // Sourcing Nodes
  lastPurchasedDate: string;
  lastPurchasedSupplier: string;
  lastPurchasedShopPrice: number; 
  lastPrice: number;              
  lastPurchasedQty: number;       
  qty: number;                    
  daysInWhSinceLastPurchase: number; 
  lastPurchasedGbpPrice: number;     
  totalNoOfPurchasesSince2024: number; 

  // Operational metrics
  rfqCount: number;               
  b2bOrdered: number;             
  orderedQty: number;             
  orderQty: number;               
  orderedPrice: number;           
  rfqDetails: string;             

  shopPrice: number;
  buyPriceVat: number;
  sellPrice: number;
  profit: number;
  googlePrice: string; 
  bbPrice90d: number;  
  combinedCurrentBsr: number;
  
  // BSR Data points
  bsr7d: number;
  bsr30d: number;
  bsr90d: number;
  bsr365d: number;
  
  bsrStyleClassName: string;

  // Buy Sheet Attributes
  fbaSeller: string;
  mfSeller: string;
  introducedBy: string;
  variation: string;
  reviewPct: string;

  variation365: string;
  supplier: string;

  // Market metrics 
  noOfSellers: number;
  maCogs: number;
  marketPrice: number;
  estimatedSales: number;
  dayBsrAllConnection: string;

  // Historical / Market Splits
  price30dMin: number; supplier30dMin: string;
  price90dMin: number; supplier90dMin: string;
  price330dMin: number; supplier330dMin: string;
  sourcingPrice10d: number; sourcingSupplier: string;
  phctMinPrice10d: number; phctMinSupplier: string;
  phctSecondMinPrice10d: number; phctSecondMinSupplier: string;
  abcMinPrice10d: number; abcMinSupplier: string;
  ukMinPrice10d: number; ukMinSupplier: string;
};

async function getGoogleSheetsClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function safeParseInt(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[^0-9.-]/g, "");
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function safeParseFloat(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export async function getDashboardData() {
  try {
    const sheets = await getGoogleSheetsClient();

    const [buySheetResponse, stockResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID_BUYSHEET_2026,
        range: "Buysheet!A:AO",
        valueRenderOption: "FORMATTED_VALUE",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID_STOCK_INVENTORY_2024,
        range: "'Stock & Inventory'!A:AO",
        valueRenderOption: "FORMATTED_VALUE",
      })
    ]);

    const buyRows = buySheetResponse.data.values || [];
    const stockRows = stockResponse.data.values || [];

    if (buyRows.length === 0) return { products: [], uniqueSuppliers: [], uniqueBrands: [], uniqueDates: [] };

    const buyHeaders = buyRows[0].map((h: string) => h.toUpperCase().trim());
    const stockHeaders = (stockRows[0] || []).map((h: string) => h.toUpperCase().trim());

    const buyIdx = {
      sourcingDate: buyHeaders.findIndex(h => h.includes("SOURCING DATE")),
      name: buyHeaders.findIndex(h => h.includes("PRODUCT NAME")),
      asin: buyHeaders.findIndex(h => h.includes("ASIN")),
      upc: buyHeaders.findIndex(h => h.includes("UPC")),
      url: buyHeaders.findIndex(h => h.includes("AMZ URL")),
      shopPrice: buyHeaders.findIndex(h => h.includes("SHOP PRICE")),
      buyPrice: buyHeaders.findIndex(h => h.includes("BUY PRICE")),
      sellPrice: buyHeaders.findIndex(h => h.includes("SELL PRICE")),
      profit: buyHeaders.findIndex(h => h.includes("PROFIT")),
      roi: buyHeaders.findIndex(h => h.includes("ROI")),
      brand: buyHeaders.findIndex(h => h.includes("BRAND")),
      
      bsr7: buyHeaders.findIndex(h => h.includes("7 DAY BSR")),
      bsr30: buyHeaders.findIndex(h => h.includes("30 DAY BSR")),
      bsr90: buyHeaders.findIndex(h => h.includes("90 DAY BSR")),
      bsr365: buyHeaders.findIndex(h => h.includes("365 DAY BSR")),
      
      fbaSeller: buyHeaders.findIndex(h => h === "FBA SELLER" || h.includes("FBA SELLER")),
      mfSeller: buyHeaders.findIndex(h => h === "MF SELLER" || h.includes("MF SELLER")),
      introducedBy: buyHeaders.findIndex(h => h.includes("INTRODUCED BY")),
      variation: buyHeaders.findIndex(h => h === "VARIATION"),
      reviewPct: buyHeaders.findIndex(h => h.includes("REVIEW PCT") || h.includes("REVIEW %")),

      sourceCode: buyHeaders.findIndex(h => h.includes("SOURCE CODE")),
      googlePrice: buyHeaders.findIndex(h => h.includes("GOOGLE PRICE")),
      bbPrice90d: buyHeaders.findIndex(h => h.includes("BB PRICE") || h.includes("90 DAYS AVERAGE")),
    };

    const stockIdx = {
      sku: stockHeaders.findIndex(h => h.includes("SKU")),
      asin: stockHeaders.findIndex(h => h.includes("ASIN")),
      totalStock: stockHeaders.findIndex(h => h.includes("TOTAL STOCK")),
      
      traFba: stockHeaders.findIndex(h => h.includes("TRA FBA")),
      reservedAmz: stockHeaders.findIndex(h => h.includes("RESERVED AMZ")),
      toAmz: stockHeaders.findIndex(h => h.includes("TO AMZ")),
      traAmz: stockHeaders.findIndex(h => h.includes("TRA AMZ")),
      sm67ah: stockHeaders.findIndex(h => h.includes("SM6 7AH")),
      traB2b: stockHeaders.findIndex(h => h.includes("TRA B2B")),
      traBay: stockHeaders.findIndex(h => h.includes("TRA BAY")),
      webShp: stockHeaders.findIndex(h => h.includes("WEB SHP")),
      traFbm: stockHeaders.findIndex(h => h.includes("TRA FBM")),
      toWhs: stockHeaders.findIndex(h => h.includes("TO WHS")),

      lastSupplier: stockHeaders.findIndex(h => h.includes("LAST PURCHASED SUPPLIER")),
      lastPrice: stockHeaders.findIndex(h => h.includes("LAST PURCHASED PRICE")),
      lastQty: stockHeaders.findIndex(h => h.includes("LAST PURCHASED QUANTITY")),
      lastDate: stockHeaders.findIndex(h => h.includes("LAST PURCHASED DATE")),
      
      currentBsr: stockHeaders.findIndex(h => h.includes("CURRENT BSR")),
      rfqCount: stockHeaders.findIndex(h => h.includes("RFQ")),
      b2bOrdered: stockHeaders.findIndex(h => h.includes("B2B ORDERED")),
      orderedQty: stockHeaders.findIndex(h => h.includes("ORDERED QTY")),
      rfqDetails: stockHeaders.findIndex(h => h.includes("RFQ DETAILS"))
    };

    const stockMap = new Map();
    for (let i = 1; i < stockRows.length; i++) {
      const row = stockRows[i];
      if (!row || row.length === 0) continue;
      const asinCol = stockIdx.asin !== -1 ? stockIdx.asin : 2;
      const asinKey = row[asinCol]?.trim().toUpperCase(); 
      if (asinKey && asinKey !== "ASIN" && asinKey !== "") {
        stockMap.set(asinKey, row);
      }
    }

    const rowsToProcess = buyRows.slice(1).filter(row => row[buyIdx.asin]?.trim());
    const activeProducts: FullProductMetricSuite[] = [];
    const dateDiscoverySet = new Set<string>();
    let recordCounter = 1;

    for (const row of rowsToProcess) {
      const itemAsin = row[buyIdx.asin]?.trim() || "";
      const rawDate = row[buyIdx.sourcingDate]?.trim() || "";
      if (rawDate) dateDiscoverySet.add(rawDate);

      const matchedStockRow = stockMap.get(itemAsin.toUpperCase()) || [];
      const getStockVal = (idx: number) => (idx !== -1 && matchedStockRow[idx] ? matchedStockRow[idx].trim() : "");

      const b2bOrderedQty = safeParseInt(getStockVal(stockIdx.b2bOrdered));
      const rfqQty = safeParseInt(getStockVal(stockIdx.rfqCount));
      const rfqComment = getStockVal(stockIdx.rfqDetails);
      const computedOrderedQty = safeParseInt(getStockVal(stockIdx.orderedQty));
      const parsedLastPrice = safeParseFloat(getStockVal(stockIdx.lastPrice));
      const parsedLastQty = safeParseInt(getStockVal(stockIdx.lastQty));
      const parsedTraFbaValue = safeParseInt(getStockVal(stockIdx.traFba));
      
      let finalStatus: "NOT REVIEWED" | "NOT SELECTED" | "RESEARCH" | "RFQ" | "PENDING" | "ORDERED" | "CANCELLED" | "ARCHIVED" = "RESEARCH";
      if (b2bOrderedQty > 0 || rfqComment.toUpperCase().includes("ORDERED")) {
        finalStatus = "ORDERED";
      } else if (rfqQty > 0) {
        finalStatus = "RFQ";
      }

      activeProducts.push({
        id: String(recordCounter++),
        asin: itemAsin,
        name: row[buyIdx.name] || "Unknown Catalog Product",
        brand: row[buyIdx.brand] || "Generic Brand",
        amazonUrl: row[buyIdx.url] || "",
        upc: row[buyIdx.upc] || "",
        sku: getStockVal(stockIdx.sku) || `SKU-NEW-${itemAsin}`,
        sourceCode: row[buyIdx.sourceCode] || "N/A",
        bqoolGroup: "Inbound Pipeline Flow",
        status: finalStatus,
        comment: rfqComment || "No notes available",
        sourcingDateStr: rawDate,
        
        totalStock: safeParseInt(getStockVal(stockIdx.totalStock)),
        amazonStock: parsedTraFbaValue,
        traFba: parsedTraFbaValue, 
        reservedAmz: safeParseInt(getStockVal(stockIdx.reservedAmz)),
        toAmz: safeParseInt(getStockVal(stockIdx.toAmz)),
        traAmz: safeParseInt(getStockVal(stockIdx.traAmz)),
        sm67ah: safeParseInt(getStockVal(stockIdx.sm67ah)),
        traB2b: safeParseInt(getStockVal(stockIdx.traB2b)),
        traBay: safeParseInt(getStockVal(stockIdx.traBay)),
        webShp: safeParseInt(getStockVal(stockIdx.webShp)),
        traFbm: safeParseInt(getStockVal(stockIdx.traFbm)),
        toWhStock: safeParseInt(getStockVal(stockIdx.toWhs)),

        rfqCount: rfqQty,
        b2bOrdered: b2bOrderedQty,
        orderedQty: computedOrderedQty,
        orderQty: computedOrderedQty || b2bOrderedQty || rfqQty,
        orderedPrice: parsedLastPrice,
        rfqDetails: rfqComment,
        
        shopPrice: safeParseFloat(row[buyIdx.shopPrice]),
        buyPriceVat: safeParseFloat(row[buyIdx.buyPrice]),
        sellPrice: safeParseFloat(row[buyIdx.sellPrice]),
        profit: safeParseFloat(row[buyIdx.profit]),
        roiPercentage: safeParseFloat(row[buyIdx.roi]),
        googlePrice: row[buyIdx.googlePrice] || "N/A",
        bbPrice90d: safeParseFloat(row[buyIdx.bbPrice90d]),

        lastPurchasedSupplier: getStockVal(stockIdx.lastSupplier) || "Not Sourced",
        lastPurchasedShopPrice: parsedLastPrice,
        lastPrice: parsedLastPrice, 
        lastPurchasedQty: parsedLastQty,
        qty: parsedLastQty,         
        lastPurchasedDate: getStockVal(stockIdx.lastDate) || "",
        daysInWhSinceLastPurchase: 0,
        lastPurchasedGbpPrice: 0,
        totalNoOfPurchasesSince2024: 0,
        
        combinedCurrentBsr: safeParseInt(getStockVal(stockIdx.currentBsr)),
        
        bsr7d: buyIdx.bsr7 !== -1 ? safeParseInt(row[buyIdx.bsr7]) : 0,
        bsr30d: buyIdx.bsr30 !== -1 ? safeParseInt(row[buyIdx.bsr30]) : 0,
        bsr90d: buyIdx.bsr90 !== -1 ? safeParseInt(row[buyIdx.bsr90]) : 0,
        bsr365d: buyIdx.bsr365 !== -1 ? safeParseInt(row[buyIdx.bsr365]) : 0,
        
        bsrStyleClassName: "text-lg md:text-xl font-bold text-slate-900 tracking-wide",

        fbaSeller: buyIdx.fbaSeller !== -1 ? (row[buyIdx.fbaSeller] || "—") : "—",
        mfSeller: buyIdx.mfSeller !== -1 ? (row[buyIdx.mfSeller] || "—") : "—",
        introducedBy: buyIdx.introducedBy !== -1 ? (row[buyIdx.introducedBy] || "—") : "—",
        variation: buyIdx.variation !== -1 ? (row[buyIdx.variation] || "—") : "—",
        reviewPct: buyIdx.reviewPct !== -1 ? (row[buyIdx.reviewPct] || "—") : "—",

        variation365: buyIdx.bsr365 !== -1 ? (row[buyIdx.bsr365] || "—") : "—",
        supplier: getStockVal(stockIdx.lastSupplier) || "Pending Verification",

        noOfSellers: 0, maCogs: 0, marketPrice: 0, estimatedSales: 0, dayBsrAllConnection: "Stable",
        sales30dFba: 0, sales30dFbm: 0, sales30dShopify: 0, sales30dEbay: 0, sales7dTotal: 0, sales14dTotal: 0,
        sales30dTotal: 0, sales90dTotal: 0, sales2026Total: 0, sales2025Total: 0, profit7d: 0,
        profit14d: 0, profit30d: 0, profit90d: 0, profit2026: 0, profit2025: 0,
        price30dMin: 0, supplier30dMin: "", price90dMin: 0, supplier90dMin: "", price330dMin: 0,
        supplier330dMin: "", sourcingPrice10d: 0, sourcingSupplier: "", phctMinPrice10d: 0,
        phctMinSupplier: "", phctSecondMinPrice10d: 0, phctSecondMinSupplier: "", abcMinPrice10d: 0,
        abcMinSupplier: "", ukMinPrice10d: 0, ukMinSupplier: ""
      });
    }

    const uniqueSuppliers = Array.from(new Set(activeProducts.map(p => p.supplier).filter(Boolean)));
    const uniqueBrands = Array.from(new Set(activeProducts.map(p => p.brand).filter(Boolean)));
    const uniqueDates = Array.from(dateDiscoverySet).filter(Boolean);
    
    return { products: activeProducts, uniqueSuppliers, uniqueBrands, uniqueDates };

  } catch (error) {
    console.error("Critical Matrix Integration Fault:", error);
    return { products: [], uniqueSuppliers: [], uniqueBrands: [], uniqueDates: [] };
  }
}

export async function updateProductOperations(id: string, updates: any) {
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createProduct(data: any) {
  console.log("Placeholder createProduct invoked with data:", data);
  revalidatePath("/dashboard");
  return { success: true, id: "placeholder-id" };
}