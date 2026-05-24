"use server";

import { google } from "googleapis";
import { revalidatePath } from "next/cache";

export type FullProductMetricSuite = {
  id: string;
  asin: string;
  name: string;
  brand: string;
  amazonUrl: string;
  sourceUrl: string;
  upc: string;
  sku: string;
  sourceCode: string; 
  bqoolGroup: string;
  status: "NOT REVIEWED" | "NOT SELECTED" | "RFQ" | "PENDING TO ORDER" | "ORDERED" | "COLLECTED" | "INVOICED" | "CANCELLED" | "CLOSED" | "CONFIRMED";
  comment: string;
  sourcingDateStr: string;
  supplierReference: string; 
  dateOrderedStr: string;     
  isConfirmedForPipeline: boolean;

  // Live Variables derived from Buysheet Columns
  liveAvailableQty: number;
  livePrice: number;
  targetQty: number;
  targetPrice: number;

// 📊 Live Zoho Analytics Sales Data Metrics
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

// 📈 Live Zoho Analytics Historical Price Over Time Trends
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
  
  // Historical Purchasing Log Trackers
  lastPurchasedDate: string;
  lastPurchasedSupplier: string;
  lastPurchasedShopPrice: number; 
  lastPrice: number;              
  lastPurchasedQty: number;       
  qty: number;                    
  daysInWhSinceLastPurchase: number; 
  lastPurchasedGbpPrice: number;     
  totalNoOfPurchasesSince2024: number; 

  // RFQ Pipeline Control References
  rfqCount: number;               
  b2bOrdered: number;             
  orderedQty: number;             
  orderQty: number;               
  orderedPrice: number;           
  rfqDetails: string;             

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

  // 1. Clean extraneous wrapping quotation markers introduced via file storage systems
  privateKey = privateKey.trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }

  // 2. Re-assign character tokens dynamically into system break configurations
  let structuralKey = privateKey.replace(/\\n/g, "\n");

  // 3. Assemble clean structural block lines safely for strict OpenSSL compatibility
  const normalizedLines = structuralKey.split("\n").map(l => l.trim()).filter(Boolean);
  const formattedKey = normalizedLines.join("\n");

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: formattedKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Internal secure helper to obtain an active Zoho Access Token via Refresh Token OAuth rotation.
 */
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
    next: { revalidate: 300 } // Cache token safely for 5 minutes
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Zoho token: ${res.statusText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Smart router for Zoho Analytics V2 Data Fetching.
 * - Routes standard tables through the quick synchronous endpoint.
 * - Routes SQL Query Reports through the official Asynchronous Bulk Export workflow.
 */

export async function fetchZohoViewData(viewId: string): Promise<any[]> {
  try {
    if (!viewId) return [];

    const accessToken = await getZohoAccessToken();
    
    // 1. Hardcoded fallback keys verified directly from your local system logs
    const orgId = (process.env.ZOHO_ORG_ID || "60026153974").trim();
    const workspaceId = (process.env.ZOHO_WORKSPACE_ID || "333938000005669388").trim();

    // Identify if the requested ID belongs to one of your SQL Query Reports
    const isQueryReport = viewId === "333938000009766799" || viewId === "333938000010405171";

    // 2. Global headers required for secure V2 routing (Org ID must be passed here)
    const baseHeaders: Record<string, string> = {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "ZANALYTICS-ORGID": orgId,
    };

    // =========================================================================
    // PATH A: SQL QUERY REPORTS (Asynchronous Bulk Export Flow)
    // =========================================================================
    if (isQueryReport) {
      const configParams = JSON.stringify({ responseFormat: "json" });
      const targetRequestUri = `https://analyticsapi.zoho.in/restapi/v2/bulk/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${encodeURIComponent(configParams)}`;

      console.log(`🎬 [Bulk] View ${viewId} detected as Query Report. Initializing Job...`);

      // Step 1: Fire the asynchronous job initialization request
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

      // Step 2: Poll status endpoint until completion (Job Code 1004)
      const statusUrl = `https://analyticsapi.zoho.in/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
      let jobCompleted = false;
      let attempts = 0;
      const maxAttempts = 20;

      console.log(`⏳ Bulk Job ${jobId} successfully created. Starting polling lifecycle...`);

      while (!jobCompleted && attempts < maxAttempts) {
        attempts++;
        // Wait 2 seconds between status checks to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
        const statusRes = await fetch(statusUrl, { headers: baseHeaders, cache: "no-store" });
        if (!statusRes.ok) continue;

        const statusJson = await statusRes.json();
        const jobCode = statusJson.data?.jobCode;

        // FIXED: Using Number() to protect against string/number comparison mismatches ("1004" vs 1004)
        if (Number(jobCode) === 1004) { 
          // Step 3: Job successful! Download the compiled dataset stream
          console.log(`🎉 Job ${jobId} compiled! Downloading final JSON payload...`);
          jobCompleted = true;
          
          const downloadUrl = `https://analyticsapi.zoho.in/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
          const dataRes = await fetch(downloadUrl, { headers: baseHeaders, cache: "no-store" });
          
          if (dataRes.ok) {
            const finalData = await dataRes.json();
            console.log(`✅ Success! Collected dataset rows from Zoho for View ${viewId}`);
            
            // Handle both wrapped and unwrapped JSON array formats securely
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

    // =========================================================================
    // PATH B: STANDARD DATA TABLES (Synchronous Export Flow)
    // =========================================================================
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

export async function getDashboardData() {
  try {
    const sheets = await getGoogleSheetsClient();

    // Fetches Google Sheets and Zoho Analytics simultaneously in parallel!
    const [buySheetResponse, stockResponse, zohoSalesData, zohoPriceData] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID_BUYSHEET_2026,
        range: "Buysheet!A:AO",
        valueRenderOption: "FORMATTED_VALUE",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID_STOCK_INVENTORY_2024,
        range: "'Stock & Inventory'!A:AO",
        valueRenderOption: "FORMATTED_VALUE",
      }),
      fetchZohoViewData(process.env.ZOHO_VIEW_ID_SALES_DATA || ""),
      fetchZohoViewData(process.env.ZOHO_VIEW_ID_PRICE_OVER_TIME || "")
    ]);

    // =========================================================================
    // -------------------------------------------------------------------------
    // Index Mapping Layer for Zoho Sales Performance Data (With Debug Logs)
    // -------------------------------------------------------------------------
    if (Array.isArray(zohoSalesData) && zohoSalesData.length > 0) {
      console.log("👉 DEBUG: Raw Row Example from Zoho Sales Report:", JSON.stringify(zohoSalesData[0]));
    } else {
      console.log("⚠️ DEBUG: Zoho Sales Report array is empty or failed to load.");
    }

    const zohoSalesMap = new Map<string, any>();
    if (Array.isArray(zohoSalesData)) {
      zohoSalesData.forEach((rowObj: any) => {
        // Find the ASIN column dynamically regardless of case/format
        const actualAsinKey = Object.keys(rowObj).find(k => k.toUpperCase().trim() === "ASIN");
        const asinKey = actualAsinKey ? String(rowObj[actualAsinKey]).trim().toUpperCase() : "";
        if (asinKey) zohoSalesMap.set(asinKey, rowObj);
      });
    }

    // -------------------------------------------------------------------------
    // Index Mapping Layer for Zoho Price Tracking Data Over Time
    // -------------------------------------------------------------------------
    if (Array.isArray(zohoPriceData) && zohoPriceData.length > 0) {
      console.log("👉 DEBUG: Raw Row Example from Zoho Price Report:", JSON.stringify(zohoPriceData[0]));
    }

    const zohoPriceMap = new Map<string, any>();
    if (Array.isArray(zohoPriceData)) {
      zohoPriceData.forEach((rowObj: any) => {
        const actualAsinKey = Object.keys(rowObj).find(k => k.toUpperCase().trim() === "ASIN");
        const asinKey = actualAsinKey ? String(rowObj[actualAsinKey]).trim().toUpperCase() : "";
        if (asinKey) zohoPriceMap.set(asinKey, rowObj);
      });
    }

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
      
      bsr7: buyHeaders.findIndex(h => h === "7 DAY BSR" || h.includes("7 DAY BSR")),
      bsr30: buyHeaders.findIndex(h => h === "30 DAY BSR" || h.includes("30 DAY BSR")),
      bsr90: buyHeaders.findIndex(h => h === "90 DAY BSR" || h.includes("90 DAY BSR")),
      bsr365: buyHeaders.findIndex(h => h === "365 DAY BSR" || h.includes("365 DAY BSR")),
      
      fbaSeller: buyHeaders.findIndex(h => h.includes("FBA SELLER")),
      mfSeller: buyHeaders.findIndex(h => h.includes("MF SELLER")),
      introducedBy: buyHeaders.findIndex(h => h.includes("INTRODUCED BY")),
      variation: buyHeaders.findIndex(h => h === "VARIATION"),
      reviewPct: buyHeaders.findIndex(h => h.includes("REVIEW")),
      sourceCode: buyHeaders.findIndex(h => h.includes("SOURCE CODE")),
      googlePrice: buyHeaders.findIndex(h => h.includes("GOOGLE PRICE")),
      bbPrice90d: buyHeaders.findIndex(h => h.includes("BB PRICE")),
      liveAvailableQty: buyHeaders.findIndex(h => h.includes("LIVE AVAILABLE")),
      livePrice: buyHeaders.findIndex(h => h.includes("LIVE PRICE")),
      // ADD THESE TWO LINES HERE:
      supplier: buyHeaders.findIndex(h => h === "SUPPLIER" || h.includes("SUPPLIER")),
      sourceUrl: buyHeaders.findIndex(h => h === "SOURCE URL" || h.includes("SOURCE URL"))
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
      if (!row || !row[stockIdx.asin]) continue;
      stockMap.set(row[stockIdx.asin].trim().toUpperCase(), row);
    }

    const activeProducts: FullProductMetricSuite[] = [];
    const dateDiscoverySet = new Set<string>();
    let recordCounter = 1;

    for (let i = 1; i < buyRows.length; i++) {
      const row = buyRows[i];
      if (!row || !row[buyIdx.asin]) continue;

      const itemAsin = row[buyIdx.asin].trim();
      const rawDate = row[buyIdx.sourcingDate]?.trim() || "";
      if (rawDate) dateDiscoverySet.add(rawDate);

      const matchedStockRow = stockMap.get(itemAsin.toUpperCase()) || [];
      const getStockVal = (idx: number) => (idx !== -1 && matchedStockRow[idx] ? matchedStockRow[idx].trim() : "");

      const rfqComment = getStockVal(stockIdx.rfqDetails);
      const isConfirmed = rfqComment.toUpperCase().includes("CONFIRMED_PIPELINE");

      const cleanBuyPrice = safeParseFloat(row[buyIdx.buyPrice]);
      const computedOrderedQty = safeParseInt(getStockVal(stockIdx.orderedQty));

      // ADD THESE TWO EXTRACTORS RIGHT HERE:
      const currentBuySheetSupplier = buyIdx.supplier !== -1 && row[buyIdx.supplier] ? String(row[buyIdx.supplier]).trim() : "Unknown";
      const currentBuySheetSourceUrl = buyIdx.sourceUrl !== -1 && row[buyIdx.sourceUrl] ? String(row[buyIdx.sourceUrl]).trim() : "";
      
      const upperAsin = itemAsin.toUpperCase();
      const salesMetric = zohoSalesMap.get(upperAsin) || {};
      const priceMetric = zohoPriceMap.get(upperAsin) || {};

      //  NEW INTELLIGENT MATCHING HELPER
const getZohoVal = (dataObj: any, targetKey: string): any => {
  if (!dataObj) return "";
  
  // 1. Convert standard search key to lowercase and strip symbols (e.g., "3 day units" -> "3dayunits")
  const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // 2. Generate a pluralized variant to handle "day" vs "days" structural mismatches automatically
  let structuralAlternative = cleanTarget;
  if (cleanTarget.includes("day") && !cleanTarget.includes("days")) {
    structuralAlternative = cleanTarget.replace("day", "days");
  } else if (cleanTarget.includes("days")) {
    structuralAlternative = cleanTarget.replace("days", "day");
  }

  // 3. Find the key matching either variation inside the Zoho payload object
  const actualKey = Object.keys(dataObj).find(k => {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleanKey === cleanTarget || cleanKey === structuralAlternative;
  });

  return actualKey ? dataObj[actualKey] : "";
};

      activeProducts.push({
        id: String(recordCounter++),
        asin: itemAsin,
        name: row[buyIdx.name] || "Unknown Catalog Product",
        brand: row[buyIdx.brand] || "Generic Brand",
        amazonUrl: row[buyIdx.url] || "",
        variation: buyIdx.variation !== -1 && row[buyIdx.variation] ? String(row[buyIdx.variation]).trim() : "-",
        reviewPct: buyIdx.reviewPct !== -1 && row[buyIdx.reviewPct] ? String(row[buyIdx.reviewPct]).trim() : "-",
        supplier: buyIdx.supplier !== -1 && row[buyIdx.supplier] ? String(row[buyIdx.supplier]).trim() : "Unknown",
        sourceUrl: buyIdx.sourceUrl !== -1 && row[buyIdx.sourceUrl] ? String(row[buyIdx.sourceUrl]).trim() : "",
        
        upc: row[buyIdx.upc] || "",
        sku: getStockVal(stockIdx.sku) || `SKU-${itemAsin}`,
        sourceCode: row[buyIdx.sourceCode] || "N/A",
        bqoolGroup: "Inbound Pipeline Flow",
        status: isConfirmed ? "CONFIRMED" : "RFQ",
        comment: rfqComment || "",
        sourcingDateStr: rawDate,
        supplierReference: "", 
        dateOrderedStr: getStockVal(stockIdx.lastDate),     
        isConfirmedForPipeline: isConfirmed,

        liveAvailableQty: buyIdx.liveAvailableQty !== -1 ? safeParseInt(row[buyIdx.liveAvailableQty]) : 0,
        livePrice: buyIdx.livePrice !== -1 ? safeParseFloat(row[buyIdx.livePrice]) : 0,
        targetQty: computedOrderedQty || 0,
        targetPrice: cleanBuyPrice || 0,

        // 📊 Live Zoho Performance Channel Extractions (Using Smart Fallbacks)
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

        // 📈 Live Zoho Historical Sourcing Optimization Extractions (Using Smart Fallbacks)
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
        
        lastPurchasedDate: getStockVal(stockIdx.lastDate),
        lastPurchasedSupplier: getStockVal(stockIdx.lastSupplier),
        lastPurchasedShopPrice: safeParseFloat(getStockVal(stockIdx.lastPrice)), 
        lastPrice: safeParseFloat(getStockVal(stockIdx.lastPrice)),              
        lastPurchasedQty: safeParseInt(getStockVal(stockIdx.lastQty)),       
        qty: safeParseInt(getStockVal(stockIdx.lastQty)),                    
        daysInWhSinceLastPurchase: 0, 
        lastPurchasedGbpPrice: 0,     
        totalNoOfPurchasesSince2024: 0, 

        rfqCount: safeParseInt(getStockVal(stockIdx.rfqCount)),               
        b2bOrdered: safeParseInt(getStockVal(stockIdx.b2bOrdered)),             
        orderedQty: computedOrderedQty,             
        orderQty: computedOrderedQty,               
        orderedPrice: safeParseFloat(getStockVal(stockIdx.lastPrice)),           
        rfqDetails: rfqComment,             

        shopPrice: safeParseFloat(row[buyIdx.shopPrice]),
        buyPriceVat: cleanBuyPrice,
        sellPrice: safeParseFloat(row[buyIdx.sellPrice]),
        profit: safeParseFloat(row[buyIdx.profit]),
        googlePrice: row[buyIdx.googlePrice] || "", 
        bbPrice90d: safeParseFloat(row[buyIdx.bbPrice90d]),  
        combinedCurrentBsr: safeParseInt(getStockVal(stockIdx.currentBsr)),
        
        bsr7d: buyIdx.bsr7 !== -1 ? safeParseInt(row[buyIdx.bsr7]) : 0,
        bsr30d: buyIdx.bsr30 !== -1 ? safeParseInt(row[buyIdx.bsr30]) : 0,
        bsr90d: buyIdx.bsr90 !== -1 ? safeParseInt(row[buyIdx.bsr90]) : 0,
        bsr365d: buyIdx.bsr365 !== -1 ? safeParseInt(row[buyIdx.bsr365]) : 0,
        
        bsrStyleClassName: "",
        fbaSeller: buyIdx.fbaSeller !== -1 ? row[buyIdx.fbaSeller] : "",
        mfSeller: buyIdx.mfSeller !== -1 ? row[buyIdx.mfSeller] : "",
        introducedBy: buyIdx.introducedBy !== -1 ? row[buyIdx.introducedBy] : "",
        
        roiPercentage: safeParseFloat(row[buyIdx.roi])
      });
    }

    const uniqueSuppliers = Array.from(new Set(activeProducts.map(p => p.supplier).filter(Boolean)));
    const uniqueBrands = Array.from(new Set(activeProducts.map(p => p.brand).filter(Boolean)));
    const uniqueDates = Array.from(dateDiscoverySet).filter(Boolean);
    
    return { products: activeProducts, uniqueSuppliers, uniqueBrands, uniqueDates };

  } catch (error) {
    console.error("Matrix Core Fault:", error);
    return { products: [], uniqueSuppliers: [], uniqueBrands: [], uniqueDates: [] };
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

export async function updateProductOperations(id: string, updates: any) {
  return { success: true };
}

export async function createProduct(data: any) {
  return { success: true, id: "mock-id" };
}