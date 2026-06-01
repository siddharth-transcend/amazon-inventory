"use server";

import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// Initialize the Supabase client using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Global In-Memory Cache Matrix to eliminate Zoho polling delays on dashboard reloads
let ZOHO_DATA_CACHE: {
  salesData: any[];
  priceData: any[];
  lastFetchedAt: number;
} | null = null;

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 Minutes Cache TTL

export type FullProductMetricSuite = {
  id: string;
  asin: string;
  dbId?: string;
  dbAsin?: string;
  name: string;
  brand: string;
  amazonUrl: string;
  sourceUrl: string;
  upc: string;
  sku: string;
  sourceCode: string; 
  bqoolGroup: string;
  status: "NOT REVIEWED" | "NOT SELECTED" | "NOT SELECTED - Stock" | "NOT SELECTED - Price" | "WAITING FOR MOV" | "BUYING FROM ANOTHER SUPPLIER" | "RFQ" | "RFQ UNDER REVIEW" | "PENDING TO ORDER" | "ORDERED" | "COLLECTED" | "INVOICED" | "CANCELLED" | "CLOSED" | "CONFIRMED";
  comment: string;
  sourcingDateStr: string;
  supplierReference: string; 
  dateOrderedStr: string;     
  isConfirmedForPipeline: boolean;

  // Notes Fields
  notesBySourcer: string;
  notesByReviewer: string;

  // Live Variables derived from Buysheet Columns
  liveAvailableQty: number;
  livePrice: number;
  targetQty: number | "";
  targetPrice: number;

  // Live Zoho Analytics Sales Data Metrics
  zohoUnits3d: number;
  zohoProfit3d: number;
  zohoUnits7d: number;
  zohoProfit7d: number;
  zohoUnits30d: number;
  zohoProfit30d: number;
  zohoUnits90d: number;
  zohoProfit90d: number;
  zohoUnits2026: number;
  zohoProfit2026: number;

  // Live Zoho Analytics Historical Price Over Time Trends
  phctMinSupplier: string;
  phctMinPrice: number;
  abcMinSupplier: string;
  abcMinPrice: number;
  ukMinSupplier: string;
  ukMinPrice: number;
  supplierMin10d: string;
  priceMin10d: number;
  supplierMin30d: string;
  priceMin30d: number;
  supplierMin90d: string;
  priceMin90d: number;
  supplierMin330d: string;
  priceMin330d: number;
  distinctsuppliercount: number;

  // Inventory & Warehouse Metrics
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
  toWhs: number;          
  
  // Historical Purchasing Log Trackers
  lastPurchasedDate: string;
  lastPurchasedSupplier: string;
  lastPurchasedShopPrice: number; 
  lastPrice: number;              
  lastPurchasedQty: number;       
  qty: number;                    
  daysInWhSinceLastPurchase: string; 
  lastPurchasedGbpPrice: number;     
  totalNoOfPurchasesSince2024: number;
  macogs: number;
  trailcogs: number;
  estimatedsales: number; 

  // RFQ Pipeline Control References
  rfqCount: number;               
  b2bOrdered: number;             
  orderedQty: number;             
  orderQty: number | "";
  orderedPrice: number;           
  rfqDetails: string; 
  purchaseOrderNumber: string;
  invoiceNumber: string;
  odooReference: string;
  invoiceQty: string;
  invoicePrice: string;            

  // Dynamic Marketplace Financial Vectors
  shopPrice: number;
  buyPriceVat: number;
  sellPrice: number;
  profit: number;
  googlePrice: string;  
  bbPrice90d: number;  
  combinedCurrentBsr: number;
  
  // Historical Sales Speeds (BSR Run Profiles)
  bsr7d: number;
  bsr30d: number;
  bsr90d: number;
  bsr365d: number;
  bsrStyleClassName: string;

  // Listing Parameters
  fbaSeller: string;
  mfSeller: string;
  introducedBy: string;
  variation: string;
  reviewPct: string;
  supplier: string;
  
  // Profit Metrics
  roiPercentage: number;
};

async function getGoogleSheetsClient() {
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

  privateKey = privateKey.trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }

  let structuralKey = privateKey.replace(/\\n/g, "\n");
  const normalizedLines = structuralKey.split("\n").map(l => l.trim()).filter(Boolean);
  const formattedKey = normalizedLines.join("\n");

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: formattedKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getZohoAccessToken(): Promise<string> {
  const tokenUrl = "https://accounts.zoho.in/oauth/v2/token";
  const params = new URLSearchParams({
    client_id: process.env.ZOHO_CLIENT_ID || "",
    client_secret: process.env.ZOHO_CLIENT_SECRET || "",
    refresh_token: process.env.ZOHO_REFRESH_TOKEN || "",
    grant_type: "refresh_token",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Zoho token: ${res.statusText}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function fetchZohoViewData(viewId: string): Promise<any[]> {
  try {
    if (!viewId) return [];

    const accessToken = await getZohoAccessToken();
    const orgId = (process.env.ZOHO_ORG_ID || "60026153974").trim();
    const workspaceId = (process.env.ZOHO_WORKSPACE_ID || "333938000005669388").trim();
    const isQueryReport = viewId === "333938000009766799" || viewId === "333938000010405171";

    const baseHeaders: Record<string, string> = {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "ZANALYTICS-ORGID": orgId,
    };

    if (isQueryReport) {
      const configParams = JSON.stringify({ responseFormat: "json" });
      const targetRequestUri = `https://analyticsapi.zoho.in/restapi/v2/bulk/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${encodeURIComponent(configParams)}`;

      console.log(`🎬 [Bulk] View ${viewId} detected as Query Report. Initializing Job...`);

      const response = await fetch(targetRequestUri, {
        method: "GET",
        headers: baseHeaders,
        cache: "no-store"
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Failed to initialize bulk job for ${viewId}:`, errText);
        return [];
      }

      const jsonResult = await response.json();
      const jobId = jsonResult.data?.jobId;
      
      if (!jobId) {
        console.error(`❌ No jobId returned from Zoho for view ${viewId}`, jsonResult);
        return [];
      }

      const statusUrl = `https://analyticsapi.zoho.in/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
      let jobCompleted = false;
      let attempts = 0;
      const maxAttempts = 20;

      console.log(`⏳ Bulk Job ${jobId} successfully created. Starting polling lifecycle...`);

      while (!jobCompleted && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
        const statusRes = await fetch(statusUrl, { headers: baseHeaders, cache: "no-store" });
        if (!statusRes.ok) continue;

        const statusJson = await statusRes.json();
        const jobCode = statusJson.data?.jobCode;

        if (Number(jobCode) === 1004) { 
          console.log(`🎉 Job ${jobId} compiled! Downloading final JSON payload...`);
          jobCompleted = true;
          
          const downloadUrl = `https://analyticsapi.zoho.in/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
          const dataRes = await fetch(downloadUrl, { headers: baseHeaders, cache: "no-store" });
          
          if (dataRes.ok) {
            const finalData = await dataRes.json();
            console.log(`✅ Success! Collected dataset rows from Zoho for View ${viewId}`);
            
            if (Array.isArray(finalData)) return finalData;
            return finalData.data || finalData.records || [];
          } else {
            const errText = await dataRes.text();
            console.error(`❌ Failed to download compiled bulk data for view ${viewId}:`, errText);
            return [];
          }
        } else if (Number(jobCode) === 1003 || Number(jobCode) === 1005) {
          console.error(`❌ Zoho Bulk job failed or was canceled internally with code: ${jobCode}`);
          return [];
        }
        
        console.log(`   ⏱️ View ...${viewId.substring(12)} | Job status code: ${jobCode}. Processing... (Attempt ${attempts})`);
      }
      
      if (!jobCompleted) {
        console.warn(`⚠️ Bulk job polling timed out after ${maxAttempts} attempts.`);
      }
      return [];
    }

    const syncConfig = JSON.stringify({ responseFormat: "json" });
    const syncUrl = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${encodeURIComponent(syncConfig)}`;

    console.log(`🎬 [Sync] Fetching standard data table view: ${viewId}`);
    
    const response = await fetch(syncUrl, {
      method: "GET",
      headers: baseHeaders,
      cache: "no-store"
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Standard synchronous fetch failed for view ${viewId}:`, errText);
      return [];
    }

    const syncJson = await response.json();
    return syncJson.data || [];

  } catch (error) {
    console.error(`❌ Critical top-level wrapper exception in fetchZohoViewData:`, error);
    return [];
  }
}

const getZohoVal = (dataObj: any, targetKey: string): any => {
  if (!dataObj) return "";
  
  const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, "");
  let structuralAlternative = cleanTarget;
  if (cleanTarget.includes("day") && !cleanTarget.includes("days")) {
    structuralAlternative = cleanTarget.replace("day", "days");
  } else if (cleanTarget.includes("days")) {
    structuralAlternative = cleanTarget.replace("days", "day");
  }

  const actualKey = Object.keys(dataObj).find((k: string) => {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleanKey === cleanTarget || cleanKey === structuralAlternative;
  });

  return actualKey ? dataObj[actualKey] : "";
};

export async function getDashboardData() {
  try {
    const now = Date.now();

    // 1. Check hot cache matrix state for the bulk Zoho metrics before starting network requests
    const useCache = ZOHO_DATA_CACHE && (now - ZOHO_DATA_CACHE.lastFetchedAt < CACHE_DURATION_MS);

    // 2. Fetch persistent items directly from Supabase Pipeline
    const { data: supabaseRows, error: sbError } = await supabase
      .from("pipeline_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (sbError) throw sbError;

    const sheets = await getGoogleSheetsClient();

    let zohoSalesData: any[] = [];
    let zohoPriceData: any[] = [];

    if (useCache && ZOHO_DATA_CACHE) {
      console.log(`⚡ Performance Cache Hit! Reusing memory rows for Zoho Query Reports.`);
      zohoSalesData = ZOHO_DATA_CACHE.salesData;
      zohoPriceData = ZOHO_DATA_CACHE.priceData;
    }

    const fetchArray: Promise<any>[] = [
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
    ];

    if (!useCache) {
      fetchArray.push(fetchZohoViewData(process.env.ZOHO_VIEW_ID_SALES_DATA || ""));
      fetchArray.push(fetchZohoViewData(process.env.ZOHO_VIEW_ID_PRICE_OVER_TIME || ""));
    }

    const resolvedFetches = await Promise.all(fetchArray);
    const buySheetResponse = resolvedFetches[0];
    const stockResponse = resolvedFetches[1];

    if (!useCache) {
      zohoSalesData = resolvedFetches[2] || [];
      zohoPriceData = resolvedFetches[3] || [];
      if (zohoSalesData.length > 0 || zohoPriceData.length > 0) {
        ZOHO_DATA_CACHE = { salesData: zohoSalesData, priceData: zohoPriceData, lastFetchedAt: now };
      }
    }

    // Index Maps for performance
    const zohoSalesMap = new Map<string, any>();
    if (Array.isArray(zohoSalesData)) {
      zohoSalesData.forEach((rowObj: any) => {
        const actualAsinKey = Object.keys(rowObj).find((k: string) => k.toUpperCase().trim() === "ASIN");
        const asinKey = actualAsinKey ? String(rowObj[actualAsinKey]).trim().toUpperCase() : "";
        if (asinKey) zohoSalesMap.set(asinKey, rowObj);
      });
    }

    const zohoPriceMap = new Map<string, any>();
    if (Array.isArray(zohoPriceData)) {
      zohoPriceData.forEach((rowObj: any) => {
        const actualAsinKey = Object.keys(rowObj).find((k: string) => k.toUpperCase().trim() === "ASIN");
        const asinKey = actualAsinKey ? String(rowObj[actualAsinKey]).trim().toUpperCase() : "";
        if (asinKey) zohoPriceMap.set(asinKey, rowObj);
      });
    }

    const buyRows = buySheetResponse.data.values || [];
    const stockRows = stockResponse.data.values || [];

    if (buyRows.length === 0) {
      return { overviewProducts: [], pipelineProducts: [], uniqueSuppliers: [], uniqueBrands: [], uniqueDates: [] };
    }

    const buyHeaders: string[] = buyRows[0].map((h: any) => String(h).toUpperCase().trim());
    const stockHeaders: string[] = (stockRows[0] || []).map((h: any) => String(h).toUpperCase().trim());

    const buyIdx = {
      sourcingDate: buyHeaders.findIndex((h: string) => h.includes("SOURCING DATE")),
      name: buyHeaders.findIndex((h: string) => h.includes("PRODUCT NAME")),
      asin: buyHeaders.findIndex((h: string) => h === "ASIN"),
      upc: buyHeaders.findIndex((h: string) => h.includes("UPC")),
      url: buyHeaders.findIndex((h: string) => h.includes("AMZ URL")),
      shopPrice: buyHeaders.findIndex((h: string) => h.includes("SHOP PRICE")),
      buyPrice: buyHeaders.findIndex((h: string) => h.includes("BUY PRICE")),
      sellPrice: buyHeaders.findIndex((h: string) => h.includes("SELL PRICE")),
      profit: buyHeaders.findIndex((h: string) => h.includes("PROFIT")),
      roi: buyHeaders.findIndex((h: string) => h.includes("ROI")),
      brand: buyHeaders.findIndex((h: string) => h.includes("BRAND")),
      bsr7: buyHeaders.findIndex((h: string) => h === "7 DAY BSR" || h.includes("7 DAY BSR")),
      bsr30: buyHeaders.findIndex((h: string) => h === "30 DAY BSR" || h.includes("30 DAY BSR")),
      bsr90: buyHeaders.findIndex((h: string) => h === "90 DAY BSR" || h.includes("90 DAY BSR")),
      bsr365: buyHeaders.findIndex((h: string) => h === "365 DAY BSR" || h.includes("365 DAY BSR")),
      fbaSeller: buyHeaders.findIndex((h: string) => h.includes("FBA SELLER")),
      mfSeller: buyHeaders.findIndex((h: string) => h.includes("MF SELLER")),
      introducedBy: buyHeaders.findIndex((h: string) => h.includes("INTRODUCED BY")),
      variation: buyHeaders.findIndex((h: string) => h === "VARIATION"),
      reviewPct: buyHeaders.findIndex((h: string) => h.includes("REVIEW")),
      sourceCode: buyHeaders.findIndex((h: string) => h.includes("SOURCE CODE")),
      googlePrice: buyHeaders.findIndex((h: string) => h.includes("GOOGLE PRICE")),
      bbPrice90d: buyHeaders.findIndex((h: string) => h.includes("BB PRICE")),
      liveAvailableQty: buyHeaders.findIndex((h: string) => h.includes("LIVE AVAILABLE")),
      livePrice: buyHeaders.findIndex((h: string) => h.includes("LIVE PRICE")),
      supplier: buyHeaders.findIndex((h: string) => h === "SUPPLIER" || h.includes("SUPPLIER")),
      sourceUrl: buyHeaders.findIndex((h: string) => h === "SOURCE URL" || h.includes("SOURCE URL")),
      notesBySourcer: buyHeaders.findIndex((h: string) => h.includes("NOTES BY SOURCER")),
      notesByReviewer: buyHeaders.findIndex((h: string) => h.includes("NOTES BY REVIEWER")),
    };

    const stockIdx = {
      sku: stockHeaders.findIndex((h: string) => h.includes("SKU")),
      asin: stockHeaders.findIndex((h: string) => h === "ASIN"),
      totalStock: stockHeaders.findIndex((h: string) => h.includes("TOTAL STOCK")),
      traFba: stockHeaders.findIndex((h: string) => h.includes("TRA FBA")),
      reservedAmz: stockHeaders.findIndex((h: string) => h.includes("RESERVED AMZ")),
      toAmz: stockHeaders.findIndex((h: string) => h.includes("TO AMZ")),
      traAmz: stockHeaders.findIndex((h: string) => h.includes("TRA AMZ")),
      sm67ah: stockHeaders.findIndex((h: string) => h.includes("SM6 7AH")),
      traB2b: stockHeaders.findIndex((h: string) => h.includes("TRA B2B")),
      traBay: stockHeaders.findIndex((h: string) => h.includes("TRA BAY")),
      webShp: stockHeaders.findIndex((h: string) => h.includes("WEB SHP")),
      traFbm: stockHeaders.findIndex((h: string) => h.includes("TRA FBM")),
      toWhs: stockHeaders.findIndex((h: string) => h.includes("TO WHS")),
      lastSupplier: stockHeaders.findIndex((h: string) => h.includes("LAST PURCHASED SUPPLIER")),
      lastPrice: stockHeaders.findIndex((h: string) => h.includes("LAST PURCHASED PRICE")),
      lastQty: stockHeaders.findIndex((h: string) => h.includes("LAST PURCHASED QUANTITY")),
      lastDate: stockHeaders.findIndex((h: string) => h.includes("LAST PURCHASED DATE")),
      currentBsr: stockHeaders.findIndex((h: string) => h.includes("CURRENT BSR")),
      rfqCount: stockHeaders.findIndex((h: string) => h.includes("RFQ")),
      b2bOrdered: stockHeaders.findIndex((h: string) => h.includes("B2B ORDERED")),
      orderedQty: stockHeaders.findIndex((h: string) => h === "ORDERED QTY" || h.includes("ORDERED QTY")),
      rfqDetails: stockHeaders.findIndex((h: string) => h.includes("RFQ DETAILS")),
      distinctsuppliercount: stockHeaders.findIndex((h: string) => h.includes("60 DAYS DISTINCT SUPPLIER COUNT")),
      bqoolGroup: stockHeaders.findIndex((h: string) => h.includes("BQL GRP")),
      daysInWhSinceLastPurchase: stockHeaders.findIndex((h: string) => h.includes("DAYS IN OUR WH")),
      macogs: stockHeaders.findIndex((h: string) => h.includes("MA COGS")),
      trailcogs: stockHeaders.findIndex((h: string) => h.includes("TRAIL COGS")),
      estimatedsales: stockHeaders.findIndex((h: string) => h.includes("ESTIMATED SALES"))
    };

    const buyMap = new Map();
    for (let i = 1; i < buyRows.length; i++) {
      if (buyRows[i] && buyRows[i][buyIdx.asin]) {
        buyMap.set(buyRows[i][buyIdx.asin].trim().toUpperCase(), buyRows[i]);
      }
    }

    const stockMap = new Map();
    for (let i = 1; i < stockRows.length; i++) {
      const row = stockRows[i];
      if (row && row[stockIdx.asin]) {
        stockMap.set(row[stockIdx.asin].trim().toUpperCase(), row);
      }
    }

    const supabaseMap = new Map();
    for (const sbRow of (supabaseRows || [])) {
      if (sbRow.asin) {
        supabaseMap.set(sbRow.asin.toUpperCase().trim(), sbRow);
      }
    }

    const dateDiscoverySet = new Set<string>();
    const uniqueSuppliersSet = new Set<string>();
    const uniqueBrandsSet = new Set<string>();

    // CRITICAL FIX: Explicitly enforce return type signature to resolve ts(2345) and widenings
    const compileProductData = (asinStr: string, sbRow: any): FullProductMetricSuite => {
      const upperAsin = asinStr.toUpperCase().trim();
      const matchedBuyRow = buyMap.get(upperAsin) || [];
      const matchedStockRow = stockMap.get(upperAsin) || [];
      const salesMetric = zohoSalesMap.get(upperAsin) || {};
      const priceMetric = zohoPriceMap.get(upperAsin) || {};

      const getBuyVal = (idx: number) => (idx !== -1 && matchedBuyRow[idx] ? matchedBuyRow[idx].trim() : "");
      const getStockVal = (idx: number) => (idx !== -1 && matchedStockRow[idx] ? matchedStockRow[idx].trim() : "");

      const rawDate = getBuyVal(buyIdx.sourcingDate);
      if (rawDate) dateDiscoverySet.add(rawDate);

      const rfqComment = getStockVal(stockIdx.rfqDetails);
      const isConfirmed = rfqComment.toUpperCase().includes("CONFIRMED_PIPELINE");
      const cleanBuyPrice = safeParseFloat(getBuyVal(buyIdx.buyPrice));
      const computedOrderedQty = safeParseInt(getStockVal(stockIdx.orderedQty));

      const brandName = getBuyVal(buyIdx.brand) || "Generic Brand";
      const supplierName = getBuyVal(buyIdx.supplier) || "Unknown";
      if (brandName) uniqueBrandsSet.add(brandName);
      if (supplierName) uniqueSuppliersSet.add(supplierName);

      return {
        id: sbRow?.id || `catalog-${upperAsin}`, 
        asin: upperAsin,
        dbId: sbRow?.id || "",
        dbAsin: sbRow?.asin || "",
        
        name: getBuyVal(buyIdx.name) || "Unknown Catalog Product",
        brand: brandName,
        amazonUrl: getBuyVal(buyIdx.url) || "",
        variation: getBuyVal(buyIdx.variation) || "-",
        reviewPct: getBuyVal(buyIdx.reviewPct) || "-",
        supplier: supplierName,
        sourceUrl: getBuyVal(buyIdx.sourceUrl) || "",
        notesBySourcer: getBuyVal(buyIdx.notesBySourcer) || "",
        notesByReviewer: getBuyVal(buyIdx.notesByReviewer) || "",
        upc: getBuyVal(buyIdx.upc) || "",
        sku: getStockVal(stockIdx.sku) || `SKU-${upperAsin}`,
        sourceCode: getBuyVal(buyIdx.sourceCode) || "N/A",
        bqoolGroup: getStockVal(stockIdx.bqoolGroup),
        sourcingDateStr: rawDate,
        supplierReference: sbRow?.supplier_reference || "", 
        dateOrderedStr: sbRow?.date_ordered_str || getStockVal(stockIdx.lastDate),     

        status: sbRow?.status || (isConfirmed ? "CONFIRMED" : "RFQ"),
        isConfirmedForPipeline: sbRow?.status ? sbRow.status === "CONFIRMED" : isConfirmed,
        comment: sbRow?.comment || rfqComment || "",

        orderedQty: sbRow?.order_qty !== undefined && sbRow?.order_qty !== null ? parseInt(sbRow.order_qty || 0, 10) : computedOrderedQty,
        targetQty: sbRow?.target_qty !== null && sbRow?.target_qty !== undefined ? sbRow.target_qty : "", 
        targetPrice: sbRow?.target_price !== undefined ? Number(sbRow.target_price || 0) : 0,
        
        purchaseOrderNumber: sbRow?.purchase_order_number || "",
        invoiceNumber: sbRow?.invoice_number || "",
        odooReference: sbRow?.odoo_reference || "",
        invoiceQty: sbRow?.invoice_qty || "",
        invoicePrice: sbRow?.invoice_price || "",

        liveAvailableQty: safeParseInt(getBuyVal(buyIdx.liveAvailableQty)),
        livePrice: safeParseFloat(getBuyVal(buyIdx.livePrice)),

        zohoUnits3d: safeParseInt(getZohoVal(salesMetric, "3 Day Units")),
        zohoProfit3d: safeParseFloat(getZohoVal(salesMetric, "3 Day Gross Profit")),
        zohoUnits7d: safeParseInt(getZohoVal(salesMetric, "7 Day Units")),
        zohoProfit7d: safeParseFloat(getZohoVal(salesMetric, "7 Day Gross Profit")),
        zohoUnits30d: safeParseInt(getZohoVal(salesMetric, "30 Day Units")),
        zohoProfit30d: safeParseFloat(getZohoVal(salesMetric, "30 Day Gross Profit")),
        zohoUnits90d: safeParseInt(getZohoVal(salesMetric, "90 Day Units")),
        zohoProfit90d: safeParseFloat(getZohoVal(salesMetric, "90 Day Gross Profit")),
        zohoUnits2026: safeParseInt(getZohoVal(salesMetric, "2026 Units")),
        zohoProfit2026: safeParseFloat(getZohoVal(salesMetric, "2026 Gross Profit")),

        phctMinSupplier: String(getZohoVal(priceMetric, "PHCT Min Supplier") || "-"),
        phctMinPrice: safeParseFloat(getZohoVal(priceMetric, "PHCT Min Price")),
        abcMinSupplier: String(getZohoVal(priceMetric, "ABC Min Supplier") || "-"),
        abcMinPrice: safeParseFloat(getZohoVal(priceMetric, "ABC Min Price")),
        ukMinSupplier: String(getZohoVal(priceMetric, "UK Min Supplier") || "-"),
        ukMinPrice: safeParseFloat(getZohoVal(priceMetric, "UK Min Price")),
        supplierMin10d: String(getZohoVal(priceMetric, "10 days min Supplier Name") || "-"),
        priceMin10d: safeParseFloat(getZohoVal(priceMetric, "10 days min Price")),
        supplierMin30d: String(getZohoVal(priceMetric, "30 days min Supplier Name") || "-"),
        priceMin30d: safeParseFloat(getZohoVal(priceMetric, "30 days min Price")),
        supplierMin90d: String(getZohoVal(priceMetric, "90 days min Supplier Name") || "-"),
        priceMin90d: safeParseFloat(getZohoVal(priceMetric, "90 days min Price")),
        supplierMin330d: String(getZohoVal(priceMetric, "330 days min Supplier Name") || "-"),
        priceMin330d: safeParseFloat(getZohoVal(priceMetric, "330 days min Price")),

        totalStock: safeParseInt(getStockVal(stockIdx.totalStock)),
        amazonStock: safeParseInt(getStockVal(stockIdx.traFba)),
        traFba: safeParseInt(getStockVal(stockIdx.traFba)),             
        reservedAmz: safeParseInt(getStockVal(stockIdx.reservedAmz)),        
        toAmz: safeParseInt(getStockVal(stockIdx.toAmz)),              
        traAmz: safeParseInt(getStockVal(stockIdx.traAmz)),             
        sm67ah: safeParseInt(getStockVal(stockIdx.sm67ah)),             
        traB2b: safeParseInt(getStockVal(stockIdx.traB2b)),             
        traBay: safeParseInt(getStockVal(stockIdx.traBay)),             
        webShp: safeParseInt(getStockVal(stockIdx.webShp)),             
        traFbm: safeParseInt(getStockVal(stockIdx.traFbm)),             
        toWhStock: safeParseInt(getStockVal(stockIdx.toWhs)),
        toWhs: safeParseInt(getStockVal(stockIdx.toWhs)),
        distinctsuppliercount: safeParseInt(getZohoVal(priceMetric, "60 days distinct supplier count")),         
        
        lastPurchasedDate: getStockVal(stockIdx.lastDate),
        lastPurchasedSupplier: getStockVal(stockIdx.lastSupplier),
        lastPurchasedShopPrice: safeParseFloat(getStockVal(stockIdx.lastPrice)), 
        lastPrice: safeParseFloat(getStockVal(stockIdx.lastPrice)),              
        lastPurchasedQty: safeParseInt(getStockVal(stockIdx.lastQty)),       
        qty: safeParseInt(getStockVal(stockIdx.lastQty)),                    
        daysInWhSinceLastPurchase: getStockVal(stockIdx.daysInWhSinceLastPurchase),
        macogs: safeParseFloat(getStockVal(stockIdx.macogs)) || 0,
        trailcogs: safeParseFloat(getStockVal(stockIdx.trailcogs)) || 0,
        estimatedsales: safeParseInt(getZohoVal(priceMetric, "Estimated Sales")),
        lastPurchasedGbpPrice: 0,     
        totalNoOfPurchasesSince2024: 0, 

        rfqCount: safeParseInt(getStockVal(stockIdx.rfqCount)),               
        b2bOrdered: safeParseInt(getStockVal(stockIdx.b2bOrdered)),             
        orderQty: sbRow?.order_qty !== undefined && sbRow?.order_qty !== null ? sbRow.order_qty : "", 
        orderedPrice: sbRow?.ordered_price !== undefined && sbRow?.ordered_price !== null ? Number(sbRow.ordered_price) : (buyIdx.shopPrice !== -1 ? safeParseFloat(getBuyVal(buyIdx.shopPrice)) : 0),              
        rfqDetails: rfqComment,             

        shopPrice: safeParseFloat(getBuyVal(buyIdx.shopPrice)),
        buyPriceVat: cleanBuyPrice,
        sellPrice: safeParseFloat(getBuyVal(buyIdx.sellPrice)),
        profit: safeParseFloat(getBuyVal(buyIdx.profit)),
        googlePrice: getBuyVal(buyIdx.googlePrice) || "", 
        bbPrice90d: safeParseFloat(getBuyVal(buyIdx.bbPrice90d)),  
        combinedCurrentBsr: safeParseInt(getStockVal(stockIdx.currentBsr)),
        
        bsr7d: safeParseInt(getBuyVal(buyIdx.bsr7)),
        bsr30d: safeParseInt(getBuyVal(buyIdx.bsr30)),
        bsr90d: safeParseInt(getBuyVal(buyIdx.bsr90)),
        bsr365d: safeParseInt(getBuyVal(buyIdx.bsr365)),
        
        bsrStyleClassName: "",
        fbaSeller: getBuyVal(buyIdx.fbaSeller),
        mfSeller: getBuyVal(buyIdx.mfSeller),
        introducedBy: getBuyVal(buyIdx.introducedBy),
        roiPercentage: safeParseFloat(getBuyVal(buyIdx.roi))
      };
    };

    // PIPELINE 1: Overview Dashboard (All items from your Buysheet)
    const overviewProducts: FullProductMetricSuite[] = [];
    for (let i = 1; i < buyRows.length; i++) {
      if (!buyRows[i] || !buyRows[i][buyIdx.asin]) continue;
      const currentAsin = buyRows[i][buyIdx.asin].trim();
      if (!currentAsin) continue;

      const activeSbRecord = supabaseMap.get(currentAsin.toUpperCase());
      overviewProducts.push(compileProductData(currentAsin, activeSbRecord));
    }

    // PIPELINE 2: Supplier Pipeline Table (Only items saved in Supabase)
    const pipelineProducts: FullProductMetricSuite[] = [];
    for (const sbRow of (supabaseRows || [])) {
      if (!sbRow.asin) continue;
      pipelineProducts.push(compileProductData(sbRow.asin, sbRow));
    }

    return {
      overviewProducts,
      pipelineProducts,
      uniqueSuppliers: Array.from(uniqueSuppliersSet).filter(Boolean),
      uniqueBrands: Array.from(uniqueBrandsSet).filter(Boolean),
      uniqueDates: Array.from(dateDiscoverySet).filter(Boolean)
    };

  } catch (error) {
    console.error("Matrix Core Fault:", error);
    return { overviewProducts: [], pipelineProducts: [], uniqueSuppliers: [], uniqueBrands: [], uniqueDates: [] };
  }
}

export async function confirmProductToPipeline(asin: string) {
  try {
    const sheets = await getGoogleSheetsClient();
    const stockResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID_STOCK_INVENTORY_2024,
      range: "'Stock & Inventory'!A:AO",
    });

    const rows = stockResponse.data.values || [];
    const headers = rows[0].map((h: string) => h.toUpperCase().trim());
    const asinIdx = headers.findIndex(h => h.includes("ASIN"));
    const rfqDetailsIdx = headers.findIndex(h => h.includes("RFQ DETAILS"));

    if (asinIdx === -1 || rfqDetailsIdx === -1) throw new Error("Missing required headers");

    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][asinIdx]?.toUpperCase().trim() === asin.toUpperCase().trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex !== -1) {
      const currentComment = rows[targetRowIndex - 1][rfqDetailsIdx] || "";
      let updatedComment = currentComment;
      if (!currentComment.toUpperCase().includes("CONFIRMED_PIPELINE")) {
        updatedComment = currentComment ? `${currentComment} | CONFIRMED_PIPELINE` : "CONFIRMED_PIPELINE";
      }
      
      const colLetter = String.fromCharCode(65 + rfqDetailsIdx);
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID_STOCK_INVENTORY_2024,
        range: `'Stock & Inventory'!${colLetter}${targetRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[updatedComment]] }
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Confirm Product Error:", err);
    return { success: false };
  }
}

function safeParseInt(val: string): number {
  if (!val) return 0;
  const clean = val.trim().replace(/(?!^-)[^0-9]/g, ""); 
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function safeParseFloat(val: string): number {
  if (!val) return 0;
  const clean = val.trim().replace(/(?!^-)[^0-9.]/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function parseZohoDuration(val: any): number {
  if (val === undefined || val === null) return 0;
  let str = String(val).trim();
  if (!str) return 0;

  if (str.includes(" ")) {
    str = str.split(" ")[0];
  }

  const clean = str.replace(/(?!^-)[^0-9]/g, "");
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function calculateDaysInWh(dateOrderedStr: string): number {
  if (!dateOrderedStr || dateOrderedStr.trim() === "" || dateOrderedStr === "-") return 0;
  
  try {
    const purchaseDate = new Date(dateOrderedStr);
    if (isNaN(purchaseDate.getTime())) return 0;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    purchaseDate.setHours(0,0,0,0);
    
    const differenceInTime = today.getTime() - purchaseDate.getTime();
    return Math.floor(differenceInTime / (1000 * 3600 * 24));
  } catch (e) {
    return 0;
  }
}

const getTodayIsoString = () => new Date().toISOString().split("T")[0];

const formatIsoStringToDisplay = (iso: string) => {
  if (!iso) return "";
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

export async function handlePartialReceipt(asin: string, qtyReceived: number) {
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID_STOCK_INVENTORY_2024;

    const stockResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Stock & Inventory'!A:AO",
    });

    const rows = stockResponse.data.values || [];
    if (rows.length === 0) throw new Error("Stock & Inventory sheet is empty.");

    const headers = rows[0].map((h: string) => h.toUpperCase().trim());
    const asinIdx = headers.findIndex(h => h.includes("ASIN"));
    const orderedQtyIdx = headers.findIndex(h => h === "ORDERED QTY" || h.includes("ORDERED QTY"));
    const rfqDetailsIdx = headers.findIndex(h => h.includes("RFQ DETAILS"));
    const lastDateIdx = headers.findIndex(h => h.includes("LAST PURCHASED DATE"));

    if (asinIdx === -1 || orderedQtyIdx === -1 || rfqDetailsIdx === -1) {
      throw new Error("Required sheet tracking columns are missing.");
    }

    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][asinIdx]?.toUpperCase().trim() === asin.toUpperCase().trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(`Product with ASIN ${asin} could not be found in the sheet.`);
    }

    const targetRowData = rows[targetRowIndex - 1];
    const totalOrderedOriginal = safeParseInt(targetRowData[orderedQtyIdx]);
    const backorderBalance = totalOrderedOriginal - qtyReceived;

    if (backorderBalance <= 0) {
      throw new Error("Quantity received must be less than total ordered to generate a backorder split.");
    }

    const originalColLetter = String.fromCharCode(65 + orderedQtyIdx);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Stock & Inventory'!${originalColLetter}${targetRowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[qtyReceived]] }
    });

    const commentColLetter = String.fromCharCode(65 + rfqDetailsIdx);
    const existingComment = targetRowData[rfqDetailsIdx] || "";
    const updatedComment = existingComment 
      ? `${existingComment} | Rec'd ${qtyReceived} units. ${backorderBalance} split to backorder on ${formatIsoStringToDisplay(getTodayIsoString())}`
      : `Rec'd ${qtyReceived} units. ${backorderBalance} split to backorder.`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Stock & Inventory'!${commentColLetter}${targetRowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[updatedComment]] }
    });

    const newBackorderRow = new Array(headers.length).fill("");
    for (let c = 0; c < targetRowData.length; c++) {
      newBackorderRow[c] = targetRowData[c] || "";
    }

    newBackorderRow[orderedQtyIdx] = backorderBalance;
    newBackorderRow[rfqDetailsIdx] = `BACKORDER tracking split from original order entry.`;
    
    if (lastDateIdx !== -1) {
      newBackorderRow[lastDateIdx] = formatIsoStringToDisplay(getTodayIsoString());
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'Stock & Inventory'!A:A",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [newBackorderRow] }
    });

    revalidatePath("/dashboard");
    return { success: true, backorderQty: backorderBalance };

  } catch (error: any) {
    console.error("Backorder Splitting Matrix Core Fault:", error);
    return { success: false, error: error.message || "Internal sheet error" };
  }
}

// ==========================================
//   PRODUCTION DATABASE WRITE-BACK ENGINES
// ==========================================

export async function createProduct(data: any) {
  try {
    const { data: newRow, error } = await supabase
      .from("pipeline_items")
      .insert([{
        asin: data.asin || null,
          upc: data.upc || null,
          source_code: data.sourceCode || null,
          name: data.name || null,
          supplier: data.sourceUrl || data.supplier || null, // Stores Excel source link cleanly
          supplier_reference: data.supplierReference || null,
          purchase_order_number: data.purchaseOrderNumber || null,
          invoice_number: data.invoiceNumber || null,
          date_ordered_str: data.dateOrderedStr || null,
          target_qty: data.targetQty !== "" ? Number(data.targetQty) : 0,
          target_price: data.targetPrice ? Number(data.targetPrice) : 0,
          order_qty: data.orderQty ? Number(data.orderQty) : 0,
          ordered_price: data.orderedPrice ? Number(data.orderedPrice) : 0,
          invoice_qty: data.invoiceQty ? Number(data.invoiceQty) : 0,
          invoice_price: data.invoicePrice ? Number(data.invoicePrice) : 0,
          odoo_reference: data.odooReference || null,
          net_profit: data.netProfit ? Number(data.netProfit) : 0,
          status: data.status || 'RFQ',
          comment: data.comment || null
      }])
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath("/dashboard");
    return { success: true, id: newRow.id, data: newRow };
  } catch (err) {
    console.error("Supabase Engine Create Failure:", err);
    return { success: false };
  }
}

export async function updateProductOperations(id: string, updates: any, userEmail: string = "unknown@system.com") {
  try {
    if (!id) {
      return { success: false, error: "Missing Target Row Primary Key Reference Token." };
    }

    // 1. Fetch current row snapshot before updating to capture its current context (SKU/PO) for the log
    const { data: currentItem } = await supabase
      .from("pipeline_items")
      .select("sku, purchase_order_number")
      .eq("id", id)
      .single();

    // Explicitly build the update payload to match your Supabase columns precisely
    const { error } = await supabase
      .from("pipeline_items") //  CORRECTED: Points directly to your table
      .update({
        status: updates.status,
        comment: updates.comment,
        
        // Strings & Text Columns
        supplier: updates.supplier || updates.sourceUrl || undefined,
        supplier_reference: updates.supplierReference,
        purchase_order_number: updates.purchaseOrderNumber,
        invoice_number: updates.invoiceNumber,
        odoo_reference: updates.odooReference,
        date_ordered_str: updates.dateOrderedStr,
        upc: updates.upc,
        source_code: updates.sourceCode,
        name: updates.name,
        brand: updates.brand,

        // ✅ FIX: Use 'undefined' as the final fallback so Supabase completely ignores untouched fields
        order_qty: updates.orderQty !== undefined ? (updates.orderQty === "" ? null : Number(updates.orderQty)) : undefined,
        ordered_price: updates.orderedPrice !== undefined ? (updates.orderedPrice === "" ? null : Number(updates.orderedPrice)) : undefined,
        target_qty: updates.targetQty !== undefined ? (updates.targetQty === "" ? null : Number(updates.targetQty)) : undefined,
        target_price: updates.targetPrice !== undefined ? (updates.targetPrice === "" ? null : Number(updates.targetPrice)) : undefined,
        invoice_qty: updates.invoiceQty !== undefined ? (updates.invoiceQty === "" ? null : Number(updates.invoiceQty)) : undefined,
        invoice_price: updates.invoicePrice !== undefined ? (updates.invoicePrice === "" ? null : Number(updates.invoicePrice)) : undefined,
        net_profit: updates.netProfit !== undefined ? (updates.netProfit === "" ? null : Number(updates.netProfit)) : undefined
      })
      .eq("id", id); // Matches and updates ONLY the exact distinct database record row UUID

    if (error) throw error;
    
// 3. 🚀 THE AUDIT TRAIL LEAF: Build the exact object payload representing what changed
const cleanedPayload: Record<string, any> = {};
Object.entries(updates).forEach(([key, value]) => {
  if (value !== undefined) cleanedPayload[key] = value;
});

// Automatically classify if this action was a Proforma file batch apply or a quick manual cell update
const calculatedActionType = updates.invoiceQty !== undefined && updates.invoicePrice !== undefined 
  ? "PROFORMA_BATCH_APPLY" 
  : "INLINE_CELL_UPDATE";

const { error: logError } = await supabase
  .from("audit_logs")
  .insert({
    user_email: userEmail,
    action_type: calculatedActionType,
    product_id: id,
    sku: currentItem?.sku || "UNKNOWN",
    purchase_order: currentItem?.purchase_order_number || "UNKNOWN",
    changes_payload: cleanedPayload
  });

if (logError) {
  console.error("Warning: Main update succeeded, but Audit Trail row failed to save:", logError.message);
}

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Supabase Engine Update Failure:", err);
    return { success: false };
  }
}
