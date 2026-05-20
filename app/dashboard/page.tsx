"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getDashboardData, updateProductOperations, FullProductMetricSuite } from "./actions";
import { 
  Sun, Moon, Search, Save, Box, LayoutDashboard, Database,
  TrendingUp, Warehouse, ShoppingCart, Filter, ExternalLink,
  Copy, Check, ChevronLeft, ChevronRight, Calendar, Download
} from "lucide-react";

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeWindow, setActiveWindow] = useState<1 | 2>(1);
  const [products, setProducts] = useState<FullProductMetricSuite[]>([]);
  const [searchAsin, setSearchAsin] = useState("");
  const [pipelineSearch, setPipelineSearch] = useState(""); 
  const [selectedProduct, setSelectedProduct] = useState<FullProductMetricSuite | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filter Target Structures
  const [brands, setBrands] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedOverviewSupplier, setSelectedOverviewSupplier] = useState<string>("");
  
  // Pipeline specific date window constraints
  const [pipelineFilterDate, setPipelineFilterDate] = useState<string>("");

  // Input Commit Form states
  const [inputOrderQty, setInputOrderQty] = useState<number>(0);
  const [orderedPrice, setOrderedPrice] = useState<number>(0);
  const [targetQty, setTargetQty] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"NOT REVIEWED" | "NOT SELECTED" | "RESEARCH" | "RFQ" | "PENDING" | "ORDERED" | "CANCELLED" | "ARCHIVED" | "OPEN" | "CLOSED">("RESEARCH");
  const [supplier, setSupplier] = useState(""); 
  const [supplierReference, setSupplierReference] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(""); 

  // Selection indexes & Bulk action fields
  const [selectedProductRowIds, setSelectedProductRowIds] = useState<Set<string>>(new Set());
  const [globalPurchaseOrderInput, setGlobalPurchaseOrderInput] = useState<string>("");

  const [locallyCommittedIds, setLocallyCommittedIds] = useState<Set<string>>(new Set());
  const [filterSupplier, setFilterSupplier] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getDashboardData();
        setProducts(res.products);
        setSuppliers(res.uniqueSuppliers || []);
        setBrands(res.uniqueBrands || []);
        
        if (res.products.length > 0) {
          loadProductToForm(res.products[0]);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []); 

  const loadProductToForm = (p: FullProductMetricSuite) => {
    setSelectedProduct(p);
    setSelectedProductId(p.id);
    setInputOrderQty(p.orderQty || 0); 
    setOrderedPrice(p.orderedPrice || 0);
    setTargetQty(p.targetQty || 0);
    setTargetPrice(p.targetPrice || 0);
    setComment(p.comment || "");
    setStatus(p.status || "RESEARCH");
    setSupplier(p.supplier || "");
    setSupplierReference(p.supplierReference || "");
    setPurchaseOrderNumber((p as any).purchaseOrderNumber || "");
  };

  const triggerCopy = (text: string, fieldId: string) => {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const parseSheetDateToIso = (dateStr: string): string => {
    if (!dateStr) return "";
    const clean = dateStr.trim();
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      let day = parts[0];
      let month = parts[1];
      let year = parts[2];
      if (day.length === 4) return `${day}-${month.padStart(2, '0')}-${year.padStart(2, '0')}`;
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return "";
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    await updateProductOperations(selectedProduct.id, { 
      orderQty: inputOrderQty, 
      orderedPrice, 
      targetQty,
      targetPrice,
      comment, 
      status,
      supplier,
      supplierReference,
      purchaseOrderNumber
    });

    setLocallyCommittedIds(prev => new Set(prev).add(selectedProduct.id));

    const updated = products.map((p) =>
      p.id === selectedProduct.id ? { 
        ...p, 
        orderQty: inputOrderQty, 
        orderedPrice, 
        targetQty,
        targetPrice,
        comment, 
        status, 
        supplier, 
        supplierReference,
        purchaseOrderNumber,
        dateOrderedStr: status === "ORDERED" && !p.dateOrderedStr ? new Date().toLocaleDateString("en-GB") : p.dateOrderedStr
      } : p
    );
    setProducts(updated);
    
    const matched = updated.find(p => p.id === selectedProduct.id);
    if (matched) setSelectedProduct(matched);
  };

  const handleInlineStatusChange = async (productId: string, nextStatus: any) => {
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;
    await updateProductOperations(productId, { ...targetProduct, status: nextStatus });
    setProducts(prev => prev.map((p) => p.id === productId ? { 
      ...p, 
      status: nextStatus,
      dateOrderedStr: nextStatus === "ORDERED" && !p.dateOrderedStr ? new Date().toLocaleDateString("en-GB") : p.dateOrderedStr
    } : p));
  };

  const handleInlineNumberChange = async (productId: string, key: 'orderQty' | 'orderedPrice' | 'targetQty' | 'targetPrice', numericVal: number) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, [key]: numericVal } : p));
    await updateProductOperations(productId, { [key]: numericVal });
  };

  const handleInlineStringBlur = async (productId: string, key: 'supplierReference' | 'comment' | 'purchaseOrderNumber', valueStr: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, [key]: valueStr } : p));
    await updateProductOperations(productId, { [key]: valueStr });
  };

  const applyBatchPurchaseOrderNumber = async () => {
    if (selectedProductRowIds.size === 0 || !globalPurchaseOrderInput.trim()) return;
    const poValue = globalPurchaseOrderInput.trim();
    
    setProducts(prev => prev.map(p => {
      if (selectedProductRowIds.has(p.id)) {
        updateProductOperations(p.id, { purchaseOrderNumber: poValue });
        return { ...p, purchaseOrderNumber: poValue };
      }
      return p;
    }));
    
    setGlobalPurchaseOrderInput("");
    setSelectedProductRowIds(new Set());
    alert(`Successfully applied PO [ ${poValue} ] across selected entries.`);
  };

  const toggleSelectRow = (rowId: string) => {
    const next = new Set(selectedProductRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    setSelectedProductRowIds(next);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.asin.toLowerCase().includes(searchAsin.toLowerCase()) || p.name.toLowerCase().includes(searchAsin.toLowerCase());
    const brandMatch = !selectedBrand || p.brand === selectedBrand;
    const supplierMatch = !selectedOverviewSupplier || p.supplier === selectedOverviewSupplier;
    return matchesSearch && brandMatch && supplierMatch && (!selectedCalendarDate || parseSheetDateToIso(p.sourcingDateStr) === selectedCalendarDate);
  });

  const pipelineFilteredProducts = products.filter((p) => {
    const hasBeenCommitted = 
      locallyCommittedIds.has(p.id) || 
      p.orderQty > 0 || 
      !["RESEARCH", "NOT REVIEWED", "NOT SELECTED"].includes(p.status);

    if (!hasBeenCommitted) return false;

    const matchSupplier = filterSupplier === "ALL" || p.supplier === filterSupplier;
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    const matchDate = !pipelineFilterDate || parseSheetDateToIso(p.sourcingDateStr) === pipelineFilterDate;
    
    let matchQuery = true;
    if (pipelineSearch.trim()) {
      const q = pipelineSearch.toLowerCase().trim();
      matchQuery = p.asin.toLowerCase().includes(q) || p.upc.toLowerCase().includes(q) || (p.supplierReference && p.supplierReference.toLowerCase().includes(q)) || ((p as any).purchaseOrderNumber && (p as any).purchaseOrderNumber.toLowerCase().includes(q));
    }
    return matchSupplier && matchStatus && matchDate && matchQuery;
  });

  const aggregateMetricsSummary = useMemo(() => {
    let units = 0; let costValue = 0; let netProfitAccumulation = 0;
    pipelineFilteredProducts.forEach((p) => {
      const q = p.orderQty || 0;
      units += q;
      costValue += q * (p.orderedPrice || 0);
      netProfitAccumulation += q * (p.profit || 0);
    });
    return { units, costValue, netProfitAccumulation };
  }, [pipelineFilteredProducts]);

  const triggerExcelSpreadsheetDownload = () => {
    if (pipelineFilteredProducts.length === 0) return;
    
    const tableHeaders = ["Sl No", "Product Name", "UPC", "Source Code", "Target Qty", "Your Price", "Target Price", "Offer Price"];
    const fileRows = pipelineFilteredProducts.map((p, index) => [
      index + 1,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.upc || ""}"`,
      `"${p.sourceCode || "N/A"}"`,
      p.targetQty || 0,
      (p.orderedPrice || 0).toFixed(2),
      (p.targetPrice || 0).toFixed(2),
      (p.sellPrice || 0).toFixed(2)
    ]);

    const csvContentString = "data:text/csv;charset=utf-8," 
      + [tableHeaders.join("\t"), ...fileRows.map(e => e.join("\t"))].join("\n");
    
    const structuredBlobUri = encodeURI(csvContentString);
    const hiddenTriggerElement = document.createElement("a");
    hiddenTriggerElement.setAttribute("href", structuredBlobUri);
    hiddenTriggerElement.setAttribute("download", `Supplier_Pipeline_Ledger_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(hiddenTriggerElement);
    hiddenTriggerElement.click();
    document.body.removeChild(hiddenTriggerElement);
  };

  const formatVal = (val: any, isCurrency = false) => {
    if (val === undefined || val === null || val === "" || val === 0 || val === "0" || val === "N/A" || val === "—") return "-";
    if (isCurrency && typeof val === "number") return `£${val.toFixed(2)}`;
    return val;
  };

  const prodData = selectedProduct as any;
  const amazonStockSum = prodData ? ((prodData.traFba || 0) + (prodData.reservedAmz || 0) + (prodData.toAmz || 0) + (prodData.traAmz || 0)) : 0;
  const whStockSum = prodData ? ((prodData.sm67ah || 0) + (prodData.traB2b || 0) + (prodData.traBay || 0) + (prodData.webShp || 0) + (prodData.traFbm || 0)) : 0;
  const orderedStockSum = prodData ? ((prodData.rfqCount || 0) + (prodData.b2bOrdered || 0) + (prodData.orderedQty || 0) + (prodData.toWhs || 0)) : 0;

  const themeTextMuted = isDarkMode ? "text-slate-400" : "text-slate-600 font-bold";
  const themeTextSubtitle = isDarkMode ? "text-slate-300" : "text-slate-700 font-semibold";
  const themeHeadingText = isDarkMode ? "text-white" : "text-slate-950 font-black";
  const themeCardBg = isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-slate-300 shadow-sm";
  const themeInputBg = isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-950 font-bold";

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-sans text-xs antialiased select-none transition-colors duration-150 ${
      isDarkMode ? "bg-[#060814] text-[#94a3b8]" : "bg-[#f1f5f9] text-slate-900"
    }`}>
      
      {/* SIDEBAR NAVIGATION PANE */}
      <aside className={`flex flex-col justify-between shrink-0 border-r transition-all duration-300 ${
        isSidebarCollapsed ? "w-[60px]" : "w-[240px]"
      } ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-slate-300 shadow-md"}`}>
        <div className="flex flex-col min-h-0">
          <div className={`p-4 flex items-center gap-3 border-b overflow-hidden ${isDarkMode ? "border-[#1e293b]" : "border-slate-200"}`}>
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shrink-0">
              <Box size={18} />
            </div>
            {!isSidebarCollapsed && (
              <div><h2 className={`font-black tracking-tight text-sm leading-none ${themeHeadingText}`}>Transcend Ltd</h2>
              <p className="text-[10px] mt-1 font-bold text-slate-500">Order Workspace</p></div>
            )}
          </div>

          <div className="p-3 space-y-1">
            <button onClick={() => setActiveWindow(1)} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-bold transition-all ${isSidebarCollapsed ? "justify-center" : "gap-3"} ${activeWindow === 1 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-indigo-50 text-indigo-950 border border-indigo-200") : "opacity-75 hover:opacity-100"}`}>
              <LayoutDashboard size={16} className="text-indigo-600 shrink-0" />
              {!isSidebarCollapsed && <span>Overview Dashboard</span>}
            </button>
            <button onClick={() => setActiveWindow(2)} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-bold transition-all ${isSidebarCollapsed ? "justify-center" : "gap-3"} ${activeWindow === 2 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-emerald-50 text-emerald-950 border border-emerald-200") : "opacity-75 hover:opacity-100"}`}>
              <Database size={16} className="text-emerald-600 shrink-0" />
              {!isSidebarCollapsed && <span>Supplier Pipeline</span>}
            </button>
          </div>
        </div>

        <div className={`p-3 border-t flex flex-col gap-2 ${isDarkMode ? "border-[#1e293b] bg-[#0d1527]" : "border-slate-200 bg-slate-50"}`}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all ${isDarkMode ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800" : "bg-white border-slate-300 text-slate-900 shadow-sm hover:bg-slate-100"}`}>
            {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
            {!isSidebarCollapsed && (isDarkMode ? "Day Vision" : "Night Vision")}
          </button>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center justify-center gap-2 py-1.5 text-slate-500 hover:text-slate-800 text-[10px] font-bold">
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE MODULE CONTAINER */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        
        <header className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${isDarkMode ? "bg-[#0b0f19]/60 border-[#1e293b]" : "bg-white border-slate-300 shadow-sm"}`}>
          <h1 className={`text-sm md:text-base font-black tracking-tight ${themeHeadingText}`}>
            {activeWindow === 1 ? "Overview Dashboard" : "Supplier Pipeline Table Management"}
          </h1>

          {activeWindow === 2 && (
            <div className="flex items-center gap-3 font-mono">
              <div className={`px-3 py-1.5 border rounded-xl flex items-center gap-2 ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-950"}`}>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total committed:</span>
                <span className="font-black text-xs">{aggregateMetricsSummary.units.toLocaleString()} pcs</span>
              </div>
              <div className={`px-3 py-1.5 border rounded-xl flex items-center gap-2 ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-950"}`}>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Spend:</span>
                <span className="font-black text-xs">£{aggregateMetricsSummary.costValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`px-3 py-1.5 border rounded-xl flex items-center gap-2 ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-950"}`}>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Net Profit:</span>
                <span className="font-black text-xs">£{aggregateMetricsSummary.netProfitAccumulation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </header>

        {activeWindow === 1 && (
          <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-hidden">
            
            {/* LEFT SIDE DISCOVERY ASSETS LIST */}
            <div className={`w-[260px] rounded-xl border flex flex-col min-h-0 shrink-0 p-3 ${themeCardBg}`}>
              <div className="mb-3 shrink-0">
                <label className={`text-[9px] font-black uppercase block mb-1 flex items-center gap-1.5 ${isDarkMode ? "text-slate-400" : "text-slate-800"}`}>
                  <Calendar size={11} className="text-indigo-600" /> Sourcing Date Calendar
                </label>
                <div className="flex gap-1.5 items-center">
                  <input type="date" value={selectedCalendarDate} onChange={(e) => setSelectedCalendarDate(e.target.value)} className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500 ${themeInputBg} ${!isDarkMode ? "scheme-light" : "scheme-dark"}`} />
                  {selectedCalendarDate && <button onClick={() => setSelectedCalendarDate("")} className="text-[10px] text-red-600 hover:underline font-black px-1">Clear</button>}
                </div>
              </div>

              <div className="relative mb-2 shrink-0">
                <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                <input type="text" placeholder="Search Catalog Asset..." value={searchAsin} onChange={(e) => setSearchAsin(e.target.value)} className={`w-full pl-9 pr-3 py-2 rounded-lg font-mono text-xs border focus:outline-none focus:border-indigo-500 ${themeInputBg}`} />
              </div>

              <div className="space-y-1.5 mb-3 shrink-0">
                <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={`w-full border rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-slate-400 text-indigo-950 font-black"}`}>
                  <option value="">ALL BRANDS (UNFILTERED)</option>
                  {brands.map((b) => (<option key={b} value={b}>{b.toUpperCase()}</option>))}
                </select>
                <select value={selectedOverviewSupplier} onChange={(e) => setSelectedOverviewSupplier(e.target.value)} className={`w-full border rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-teal-400" : "bg-white border-slate-400 text-teal-950 font-black"}`}>
                  <option value="">ALL SUPPLIERS (UNFILTERED)</option>
                  {suppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => loadProductToForm(p)} className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col ${selectedProductId === p.id ? "bg-indigo-600/10 border-indigo-600 shadow-sm" : `${isDarkMode ? "bg-[#060814]/60 border-[#1e293b]/70 hover:bg-[#060814]" : "bg-slate-50 border-slate-200 hover:bg-white"}`}`}>
                    <div className="flex justify-between items-center w-full font-mono">
                      <span className={`font-black text-xs ${selectedProductId === p.id ? "text-indigo-600" : (isDarkMode ? "text-white" : "text-slate-950")}`}>{p.asin}</span>
                      <span className="text-[9px] font-bold text-slate-500">{p.sourcingDateStr}</span>
                    </div>
                    <span className={`text-xs font-bold truncate w-full mt-1.5 ${themeTextSubtitle}`}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN CORE METRICS MATRIX */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {selectedProduct ? (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 shrink-0">
                    {/* ASIN DATA CARD */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${themeCardBg}`}>
                      <span className={`text-[10px] font-black uppercase block border-b border-slate-400/30 pb-1.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-950"}`}>CONSOLIDATED IDENTIFIERS</span>
                      <div className="space-y-1.5 font-mono text-[11px] my-2">
                        <div className="flex items-center justify-between bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/20">
                          <span className={`font-bold flex items-center gap-1.5 ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>
                            ASIN: <a href={`https://www.amazon.co.uk/dp/${prodData.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-black hover:underline flex items-center gap-0.5">{prodData.asin} <ExternalLink size={9} /></a>
                          </span>
                          <button onClick={() => triggerCopy(prodData.asin, "asin")} className={`p-1 rounded transition-all ${isDarkMode ? "bg-slate-800/60 text-slate-200" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>{copiedField === "asin" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}</button>
                        </div>
                        <div className="flex items-center justify-between px-1"><span className={themeTextMuted}>SKU: <strong className={isDarkMode ? "text-slate-200" : "text-slate-950 font-black"}>{prodData.sku || "—"}</strong></span></div>
                        <div className="flex items-center justify-between px-1"><span className={themeTextMuted}>UPC: <strong className={isDarkMode ? "text-slate-200" : "text-slate-950 font-black"}>{prodData.upc || "—"}</strong></span></div>
                        <div className={`p-1 rounded border flex items-center justify-between ${isDarkMode ? "bg-slate-900/40 border-slate-800/40" : "bg-slate-100 border-slate-300"}`}><span className="text-emerald-600 font-black truncate">Src: {prodData.sourceCode || "N/A"}</span></div>
                      </div>
                      <div className="text-[10px] border-t border-dashed border-slate-400/30 pt-1 text-slate-500 font-bold">Brand: <strong className={isDarkMode ? "text-slate-200" : "text-slate-950 font-black"}>{prodData.brand}</strong></div>
                    </div>

                    {/* BSR HISTORY */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${themeCardBg}`}>
                      <span className="text-[10px] font-black uppercase tracking-wider block border-b border-slate-400/30 pb-1 mb-1 text-slate-500">4-Tier Sales Rank BSR</span>
                      <div className="grid grid-cols-2 gap-2 text-center font-mono flex-1 items-center">
                        {[{ l: "7D BSR", v: prodData.bsr7d }, { l: "30D BSR", v: prodData.bsr30d }, { l: "90D BSR", v: prodData.bsr90d }, { l: "365D BSR", v: prodData.bsr365d }].map((b, i) => (
                          <div key={i} className={`p-1 rounded border ${isDarkMode ? "bg-slate-900/50 border-slate-800/60" : "bg-slate-100 border-slate-300"}`}><span className="text-[8px] text-slate-500 block font-bold">{b.l}</span><span className={`text-xs md:text-sm font-black ${isDarkMode ? "text-indigo-400" : "text-indigo-700"}`}>{b.v > 0 ? `#${b.v.toLocaleString()}` : "-"}</span></div>
                        ))}
                      </div>
                    </div>

                    {/* ANALYSED MARGIN PRICES */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${themeCardBg}`}>
                      <span className={`text-[10px] font-black uppercase tracking-wider block border-b border-slate-400/30 pb-1 ${isDarkMode ? "text-indigo-400" : "text-indigo-950"}`}>ANALYSED PRICE MARGINS</span>
                      <div className="grid grid-cols-2 gap-2 font-mono my-auto">
                        <div className={`p-1.5 rounded border ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] block uppercase font-bold">Shop</span><span className={`font-black text-xs ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>{formatVal(prodData.shopPrice, true)}</span></div>
                        <div className={`p-1.5 rounded border ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] block uppercase font-bold">Buy VAT</span><span className="font-black text-xs text-red-600">{formatVal(prodData.buyPriceVat, true)}</span></div>
                        <div className={`p-1.5 rounded border ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] block uppercase font-bold">Sell Rate</span><span className="font-black text-xs text-emerald-600">{formatVal(prodData.sellPrice, true)}</span></div>
                        <div className={`p-1.5 rounded border ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] block uppercase font-bold">90D BB Avg</span><span className="font-black text-xs text-blue-600">{formatVal(prodData.bbPrice90d, true)}</span></div>
                      </div>
                      <div className="text-[10px] font-bold truncate pt-1 border-t border-dashed border-slate-400/30 text-slate-500">Market Price: <span className={`font-black ${isDarkMode ? "text-slate-200" : "text-slate-950 text-xs"}`}>{prodData.googlePrice || "N/A"}</span></div>
                    </div>

                    {/* ATTRIBUTE MATRIX */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${themeCardBg}`}>
                      <span className={`text-[10px] font-black uppercase block border-b border-slate-400/30 pb-1 ${isDarkMode ? "text-teal-400" : "text-teal-950"}`}>BUYSHEET ATTRIBUTE MATRIX</span>
                      <div className="grid grid-cols-2 gap-2 font-mono my-auto">
                        <div className={`p-1 border rounded text-center ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] uppercase block font-bold">FBA / MF</span><span className={`text-[11px] font-black ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>{formatVal(prodData.fbaSeller)} / {formatVal(prodData.mfSeller)}</span></div>
                        <div className={`p-1 border rounded text-center truncate ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] uppercase block font-bold">Introduced By</span><span className="text-[11px] font-black text-indigo-600 truncate block px-1">{formatVal(prodData.introducedBy)}</span></div>
                        <div className={`p-1 border rounded text-center truncate ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] uppercase block font-bold">Variation</span><span className="text-[11px] font-black text-amber-700 truncate block px-1">{formatVal(prodData.variation)}</span></div>
                        <div className={`p-1 border rounded text-center ${isDarkMode ? "bg-slate-900/30 border-slate-800/40" : "bg-slate-50 border-slate-300"}`}><span className="text-slate-500 text-[8px] uppercase block font-bold">Review Pct</span><span className="text-[11px] font-black text-teal-600">{prodData.reviewPct || "-"}</span></div>
                      </div>
                      <div className="text-[10px] font-bold truncate pt-1 border-t border-dashed border-slate-400/30 text-slate-500">Vendor: <span className={`font-black ${isDarkMode ? "text-slate-300" : "text-slate-950"}`}>{prodData.supplier}</span></div>
                    </div>

                    {/* PROFIT FINANCIAL SNAPSHOT */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] bg-gradient-to-br ${isDarkMode ? "from-emerald-950/20 to-slate-900/50 border-emerald-500/20" : "from-emerald-50 to-white border-emerald-300 shadow-sm"}`}>
                      <span className="text-[10px] font-black text-emerald-700 uppercase block border-b border-emerald-500/20 pb-1">FINANCIAL YIELD SNAPSHOT</span>
                      <div className="flex flex-col gap-2.5 my-auto font-mono text-center">
                        <div className={`p-2 rounded border ${isDarkMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-100/60 border-emerald-300"}`}>
                          <span className="text-slate-500 text-[8px] uppercase block font-bold">Calculated Net Profit</span>
                          <span className="font-black text-lg md:text-xl text-emerald-600 dark:text-emerald-400">{formatVal(prodData.profit, true)}</span>
                        </div>
                        <div className={`p-2 rounded border ${isDarkMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-100/60 border-emerald-300"}`}>
                          <span className="text-slate-500 text-[8px] uppercase block font-bold">Return on Invest (ROI)</span>
                          <span className="font-black text-lg md:text-xl text-teal-600 dark:text-teal-400">{prodData.roiPercentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SALES AND PROFIT CHANNEL WORKSPACE */}
                  <div className="shrink-0 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1 text-indigo-600 font-black uppercase text-[10px] tracking-wider"><ShoppingCart size={14} /> 1. Channel Sales Run Matrix</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[{ l: "30D Amazon FBA", v: formatVal(prodData.sales30dFba) }, { l: "30D Amazon FBM", v: formatVal(prodData.sales30dFbm) }, { l: "30D Shopify Node", v: formatVal(prodData.sales30dShopify) }, { l: "30D eBay Gateway", v: formatVal(prodData.sales30dEbay) }].map((x, i) => (
                          <div key={i} className={`p-4 rounded-xl border text-center ${themeCardBg}`}>
                            <div className="text-[9px] font-black text-slate-500 uppercase">{x.l}</div>
                            <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{x.v}</div>
                          </div>
                        ))}
                        <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-indigo-600/5 border-indigo-500/30 text-indigo-400" : "bg-indigo-100 border-indigo-300 text-indigo-950 shadow-sm"}`}>
                          <div className="text-[9px] font-black uppercase text-slate-500">7D / 14D / 30D Total</div>
                          <div className={`text-xs font-black font-mono mt-2 text-center ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.sales7dTotal)} | {formatVal(prodData.sales14dTotal)} | {formatVal(prodData.sales30dTotal)}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1 text-emerald-600 font-black uppercase text-[10px] tracking-wider"><TrendingUp size={14} /> 2. Historical Profit Snapshot</div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {[{ l: "7D Profit", v: formatVal(prodData.profit7d, true) }, { l: "14D Profit", v: formatVal(prodData.profit14d, true) }, { l: "30D Profit", v: formatVal(prodData.profit30d, true) }, { l: "90D Profit", v: formatVal(prodData.profit90d, true) }].map((x, i) => (
                          <div key={i} className={`p-4 rounded-xl border text-center ${themeCardBg}`}>
                            <div className="text-[9px] font-black text-slate-500 uppercase">{x.l}</div>
                            <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">{x.v}</div>
                          </div>
                        ))}
                        {[{ l: "2025 Accumulation", v: formatVal(prodData.profit2025, true) }, { l: "2026 Tracking", v: formatVal(prodData.profit2026, true) }].map((x, i) => (
                          <div key={i} className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-emerald-600/5 border-emerald-500/30 text-slate-200" : "bg-emerald-100 border-emerald-300 text-emerald-950"}`}>
                            <div className="text-[9px] font-black uppercase text-slate-500">
                              {x.l}
                            </div>
                            <div className={`text-sm font-black font-mono mt-1.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* COMPREHENSIVE STOCK TILES RESOLUTION */}
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1 text-amber-600 font-black uppercase text-[10px] tracking-wider"><Warehouse size={14} /> 3. Stock & Inventory Ledger Matrix</div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        
                        {/* AMAZON STOCK TILE */}
                        <div className={`p-3.5 rounded-xl border ${themeCardBg}`}>
                          <div className="flex justify-between items-center border-b border-slate-400/30 pb-1.5 mb-2">
                            <span className="text-[10px] font-black text-indigo-500 uppercase">Amazon Stock</span>
                            <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-200">Sum: {formatVal(amazonStockSum)}</span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono">
                            {[{ n: "TRA FBA:", v: formatVal(prodData.traFba) }, { n: "Reserved AMZ:", v: formatVal(prodData.reservedAmz) }, { n: "TO AMZ:", v: formatVal(prodData.toAmz) }, { n: "TRA AMZ:", v: formatVal(prodData.traAmz) }].map((v, i) => (
                              <div key={i} className="flex justify-between border-b border-slate-400/20 pb-0.5">
                                <span className={themeTextMuted}>{v.n}</span>
                                <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{v.v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* WH STOCK TILE */}
                        <div className={`p-3.5 rounded-xl border ${themeCardBg}`}>
                          <div className="flex justify-between items-center border-b border-slate-400/30 pb-1.5 mb-2">
                            <span className="text-[10px] font-black text-amber-500 uppercase">WH Stock</span>
                            <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-200">Sum: {formatVal(whStockSum)}</span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono">
                            {[{ n: "SM6 7AH:", v: formatVal(prodData.sm67ah) }, { n: "TRA B2B:", v: formatVal(prodData.traB2b) }, { n: "TRA BAY:", v: formatVal(prodData.traBay) }, { n: "WEB SHP:", v: formatVal(prodData.webShp) }, { n: "TRA FBM:", v: formatVal(prodData.traFbm) }].map((v, i) => (
                              <div key={i} className="flex justify-between border-b border-slate-400/20 pb-0.5">
                                <span className={themeTextMuted}>{v.n}</span>
                                <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{v.v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ORDERED STOCK TILE */}
                        <div className={`p-3.5 rounded-xl border ${themeCardBg}`}>
                          <div className="flex justify-between items-center border-b border-slate-400/30 pb-1.5 mb-2">
                            <span className="text-[10px] font-black text-teal-500 uppercase">Ordered Stock</span>
                            <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-teal-100 text-teal-950 border border-teal-200">Sum: {formatVal(orderedStockSum)}</span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono">
                            <div className="flex justify-between border-b border-slate-400/20 pb-0.5">
                              <span className={themeTextMuted}>RFQ Count:</span>
                              <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.rfqCount)}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-0.5">
                              <span className={themeTextMuted}>B2B Ordered:</span>
                              <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.b2bOrdered)}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-0.5">
                              <span className={themeTextMuted}>Ordered Qty:</span>
                              <span className="font-black text-indigo-600 dark:text-indigo-400">{formatVal(prodData.orderedQty)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={themeTextMuted}>TO WHS:</span>
                              <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.toWhs)}</span>
                            </div>
                          </div>
                        </div>

                        {/* DETAILS TILE */}
                        <div className={`p-3.5 rounded-xl border ${themeCardBg}`}>
                          <div className="text-[10px] font-black text-purple-500 uppercase mb-1">Ordered/RFQ Details</div>
                          <p className={`text-[11px] font-sans italic line-clamp-4 mt-1 leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{prodData.rfqDetails || "No RFQ arguments logged."}</p>
                        </div>

                        {/* LAST PURCHASE DETAILS TILE */}
                        <div className={`p-3.5 rounded-xl border ${themeCardBg}`}>
                          <div className="text-[10px] font-black text-emerald-500 uppercase mb-2">Last Purchase Details</div>
                          <div className="space-y-1 text-[10px] font-mono">
                            <div className="flex flex-col border-b border-slate-400/20 pb-1">
                              <span className="text-[9px] text-slate-500 uppercase font-bold">Last Price:</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400">{formatVal(prodData.lastPrice, true)}</span>
                            </div>
                            <div className="flex flex-col border-b border-slate-400/20 pb-1">
                              <span className="text-[9px] text-slate-500 uppercase font-bold">Vendor Node:</span>
                              <span className={`font-black truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{prodData.lastPurchasedSupplier || "N/A"}</span>
                            </div>
                            <div className="flex justify-between text-[9px] mt-1 text-slate-400">
                              <span>Date: <strong className={isDarkMode ? 'text-slate-100' : 'text-slate-950'}>{prodData.lastPurchasedDate || "—"}</strong></span>
                              <span>Qty: <strong className={isDarkMode ? 'text-slate-100' : 'text-slate-950'}>{formatVal(prodData.qty)}</strong></span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* ACTION STRIP FORM OVERVIEW SECTION */}
                  <div className={`p-4 rounded-xl border shrink-0 bg-gradient-to-r ${isDarkMode ? "from-[#0d1527] to-[#0b0f19] border-[#1e293b]" : "from-slate-100 to-white border-slate-300 shadow-md"}`}>
                    <form onSubmit={handleSaveChanges} className="space-y-3.5">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="w-24 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Order Qty</label>
                          <input type="number" value={inputOrderQty} onChange={(e) => setInputOrderQty(parseInt(e.target.value) || 0)} className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:border-indigo-500 ${themeInputBg}`} />
                        </div>

                        <div className="w-28 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cost Price (£)</label>
                          <input type="number" step="0.01" value={orderedPrice} onChange={(e) => setOrderedPrice(parseFloat(e.target.value) || 0)} className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:border-indigo-500 ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-emerald-400" : "bg-white border-slate-400 text-emerald-700"}`} />
                        </div>

                        <div className="w-32 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Supplier Ref</label>
                          <input type="text" placeholder="Ref code..." value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs font-mono font-black focus:outline-none ${themeInputBg}`} />
                        </div>

                        <div className="w-32 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">PO Number</label>
                          <input type="text" placeholder="PO tag..." value={purchaseOrderNumber} onChange={(e) => setPurchaseOrderNumber(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs font-mono font-black focus:outline-none ${themeInputBg}`} />
                        </div>

                        <div className="w-36 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Supplier Node</label>
                          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-teal-400" : "bg-white border-slate-400 text-teal-950"}`}>
                            <option value="">SELECT SUPPLIER...</option>
                            {suppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                          </select>
                        </div>

                        <div className="w-36 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Pipeline Status</label>
                          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={`w-full border rounded-lg px-3 py-2 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-slate-400 text-indigo-950"}`}>
                            <option value="NOT REVIEWED">NOT REVIEWED</option>
                            <option value="NOT SELECTED">NOT SELECTED</option>
                            <option value="RESEARCH">RESEARCH</option>
                            <option value="RFQ">RFQ</option>
                            <option value="PENDING">PENDING</option>
                            <option value="ORDERED">ORDERED</option>
                            <option value="OPEN">OPEN</option>
                            <option value="CLOSED">CLOSED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 border-t border-slate-400/20 pt-3">
                        <div className="w-24 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Target Qty</label>
                          <input type="number" value={targetQty} onChange={(e) => setTargetQty(parseInt(e.target.value) || 0)} className={`w-full border rounded-lg px-3 py-1.5 text-xs font-mono text-center focus:outline-none ${themeInputBg}`} />
                        </div>

                        <div className="w-28 shrink-0">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Target Price (£)</label>
                          <input type="number" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)} className={`w-full border rounded-lg px-3 py-1.5 text-xs font-mono text-center focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-amber-400" : "bg-white border-slate-400 text-amber-700"}`} />
                        </div>

                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Internal Log Commentary</label>
                          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Log statement notes..." className={`w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none ${themeInputBg}`} />
                        </div>
                        
                        <button type="submit" className="h-8 self-end flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 rounded-lg shadow uppercase text-[10px] tracking-wider"><Save size={12} /> Commit Changes</button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className={`p-12 text-center rounded-xl border flex-1 flex flex-col items-center justify-center ${themeCardBg} text-slate-400 font-bold text-sm`}>Select an active ASIN lookup parameter sequence from the Explorer component mapping node to begin analysis.</div>
              )}
            </div>

          </div>
        )}

        {/* WORKSPACE MODULE 2: SUPPLIER PIPELINE WINDOW */}
        {activeWindow === 2 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 p-4 overflow-y-auto custom-scrollbar">
            
            <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 ${themeCardBg}`}>
              <div className="flex items-center gap-2 text-indigo-500 font-black uppercase text-[10px] tracking-wider shrink-0"><Filter size={14} /> Pipeline Engines:</div>
              
              <div className="w-full lg:w-52">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Unified Search (ASIN/UPC/PO)</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                  <input type="text" placeholder="Query identifiers..." value={pipelineSearch} onChange={(e) => setPipelineSearch(e.target.value)} className={`w-full pl-8 pr-2 py-1 rounded border text-xs focus:outline-none font-mono font-bold ${themeInputBg}`} />
                </div>
              </div>

              <div className="w-full lg:w-36">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Sourcing Date Filter</label>
                <input type="date" value={pipelineFilterDate} onChange={(e) => setPipelineFilterDate(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-mono font-bold focus:outline-none ${themeInputBg}`} />
              </div>

              <div className="w-full lg:w-36">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">By Vendor</label>
                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL VENDORS</option>
                  {suppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                </select>
              </div>

              <div className="w-full lg:w-36">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">By Tracking Lane</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL TRACKING LANES</option>
                  <option value="NOT REVIEWED">NOT REVIEWED</option>
                  <option value="NOT SELECTED">NOT SELECTED</option>
                  <option value="RESEARCH">RESEARCH</option>
                  <option value="RFQ">RFQ</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ORDERED">ORDERED</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className={`p-1.5 rounded-lg border flex items-center gap-2 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-300'}`}>
                <input type="text" placeholder="Assign PO to selected..." value={globalPurchaseOrderInput} onChange={(e) => setGlobalPurchaseOrderInput(e.target.value)} className={`px-2 py-1 text-xs border rounded w-36 ${themeInputBg}`} />
                <button type="button" onClick={applyBatchPurchaseOrderNumber} disabled={selectedProductRowIds.size === 0 || !globalPurchaseOrderInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black px-3 py-1 rounded text-[10px] uppercase tracking-wide">Assign PO ({selectedProductRowIds.size})</button>
              </div>

              <button type="button" onClick={triggerExcelSpreadsheetDownload} disabled={pipelineFilteredProducts.length === 0} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black px-3 py-2 rounded-lg ml-auto flex items-center gap-1.5 text-[10px] tracking-wider uppercase"><Download size={13} /> Excel Export</button>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col min-h-0 ${themeCardBg}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className={`uppercase text-[9px] tracking-wider border-b font-black ${isDarkMode ? "bg-[#060814] text-slate-300 border-slate-900" : "bg-slate-100 text-slate-900 border-slate-400"}`}>
                      <th className="p-3 text-center w-10">
                        <input type="checkbox" checked={pipelineFilteredProducts.length > 0 && selectedProductRowIds.size === pipelineFilteredProducts.length} onChange={(e) => {
                          if (e.target.checked) setSelectedProductRowIds(new Set(pipelineFilteredProducts.map(x => x.id)));
                          else setSelectedProductRowIds(new Set());
                        }} className="rounded cursor-pointer" />
                      </th>
                      <th className="p-3">ASIN</th>
                      <th className="p-3">UPC</th>
                      <th className="p-3">Product Name Title</th>
                      <th className="p-3 text-center">Supplier Node</th>
                      <th className="p-3 text-center">Supplier Reference</th>
                      <th className="p-3 text-center">Purchase Order (PO)</th>
                      <th className="p-3 text-center">Date Ordered</th>
                      <th className="p-3 text-center">Target Qty</th>
                      <th className="p-3 text-center">Target Price</th>
                      <th className="p-3 text-center">Units Committed</th>
                      <th className="p-3 text-right">Cost Price</th>
                      <th className="p-3 text-right">Net Profit (Unit)</th>
                      <th className="p-3 text-center">Pipeline Status</th>
                      <th className="p-3">Internal Log Commentary</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? "divide-slate-800/60" : "divide-slate-300"}`}>
                    {pipelineFilteredProducts.length > 0 ? (
                      pipelineFilteredProducts.map((p) => {
                        return (
                          <tr key={p.id} className={`transition-colors ${isDarkMode ? "hover:bg-[#060814]/40" : "hover:bg-slate-50"}`}>
                            <td className="p-3 text-center">
                              <input type="checkbox" checked={selectedProductRowIds.has(p.id)} onChange={() => toggleSelectRow(p.id)} className="rounded cursor-pointer" />
                            </td>
                            <td className="p-3 font-black text-indigo-500">{p.asin}</td>
                            <td className={`p-3 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{p.upc || "—"}</td>
                            <td className={`p-3 max-w-xs truncate font-sans font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{p.name}</td>
                            <td className="p-3 text-center font-black text-teal-600">{p.supplier || "—"}</td>
                            
                            <td className="p-2 text-center">
                              <input type="text" value={p.supplierReference || ""} onChange={(e) => handleInlineStringBlur(p.id, 'supplierReference', e.target.value)} placeholder="Ref..." className={`w-24 px-2 py-0.5 text-xs border rounded font-mono text-center focus:outline-none ${themeInputBg}`} />
                            </td>

                            <td className="p-2 text-center">
                              <input type="text" value={(p as any).purchaseOrderNumber || ""} onChange={(e) => handleInlineStringBlur(p.id, 'purchaseOrderNumber', e.target.value)} placeholder="PO #..." className={`w-24 px-2 py-0.5 text-xs border rounded font-mono text-center focus:outline-none ${themeInputBg}`} />
                            </td>

                            <td className={`p-3 text-center font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{p.dateOrderedStr || "—"}</td>
                            
                            <td className="p-2 text-center">
                              <input type="number" value={p.targetQty || 0} onChange={(e) => handleInlineNumberChange(p.id, 'targetQty', parseInt(e.target.value) || 0)} className={`w-16 px-1.5 py-0.5 border rounded text-center text-xs font-mono font-bold ${themeInputBg}`} />
                            </td>

                            <td className="p-2 text-center">
                              <input type="number" step="0.01" value={p.targetPrice || 0} onChange={(e) => handleInlineNumberChange(p.id, 'targetPrice', parseFloat(e.target.value) || 0)} className={`w-20 px-1.5 py-0.5 border rounded text-center text-xs font-mono font-bold ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-amber-400" : "bg-white border-slate-400 text-amber-700"}`} />
                            </td>

                            <td className="p-2 text-center">
                              <input type="number" value={p.orderQty || 0} onChange={(e) => handleInlineNumberChange(p.id, 'orderQty', parseInt(e.target.value) || 0)} className={`w-16 px-1.5 py-0.5 border rounded text-center text-xs font-mono font-bold ${themeInputBg}`} />
                            </td>

                            <td className="p-2 text-center">
                              <input type="number" step="0.01" value={p.orderedPrice || 0} onChange={(e) => handleInlineNumberChange(p.id, 'orderedPrice', parseFloat(e.target.value) || 0)} className={`w-20 px-1.5 py-0.5 border rounded text-center text-xs font-mono font-bold ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-emerald-400" : "bg-white border-slate-400 text-emerald-700"}`} />
                            </td>

                            <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">£{(p.profit || 0).toFixed(2)}</td>

                            <td className="p-2 text-center">
                              <select value={p.status} onChange={(e) => handleInlineStatusChange(p.id, e.target.value as any)} className={`border rounded px-2 py-0.5 text-[10px] font-black focus:outline-none ${
                                p.status === "ORDERED" ? "bg-emerald-100 text-emerald-950 border-emerald-300" :
                                "bg-indigo-100 text-indigo-950 border-indigo-300"
                              }`}>
                                <option value="NOT REVIEWED">NOT REVIEWED</option>
                                <option value="NOT SELECTED">NOT SELECTED</option>
                                <option value="RESEARCH">RESEARCH</option>
                                <option value="RFQ">RFQ</option>
                                <option value="PENDING">PENDING</option>
                                <option value="ORDERED">ORDERED</option>
                                <option value="OPEN">OPEN</option>
                                <option value="CLOSED">CLOSED</option>
                              </select>
                            </td>

                            <td className="p-2">
                              <input type="text" value={p.comment || ""} onChange={(e) => handleInlineStringBlur(p.id, 'comment', e.target.value)} placeholder="Log note..." className={`w-full min-w-[150px] px-2 py-0.5 text-xs border rounded ${themeInputBg}`} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={15} className="p-8 text-center text-slate-500 font-sans font-bold italic">No product lanes match filters or have been committed during this session.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}