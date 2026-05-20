"use client";

import React, { useState, useEffect } from "react";
import { getDashboardData, updateProductOperations, FullProductMetricSuite } from "./actions";
import { 
  Sun, Moon, Search, Save, Box, LayoutDashboard, Database,
  TrendingUp, Warehouse, ShoppingCart, Filter, ExternalLink,
  Copy, Check, ChevronLeft, ChevronRight, Calendar
} from "lucide-react";

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeWindow, setActiveWindow] = useState<1 | 2>(1);
  const [products, setProducts] = useState<FullProductMetricSuite[]>([]);
  const [searchAsin, setSearchAsin] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<FullProductMetricSuite | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filter Tracking Arrays
  const [brands, setBrands] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  
  // Date Picker states
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedOverviewSupplier, setSelectedOverviewSupplier] = useState<string>("");

  // Input Commit Form fields
  const [inputOrderQty, setInputOrderQty] = useState<number>(0);
  const [orderedPrice, setOrderedPrice] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<any>("RESEARCH");
  const [supplier, setSupplier] = useState(""); 

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
          const firstProd = res.products[0];
          loadProductToForm(firstProd);
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
    setInputOrderQty(p.orderQty || 0); // Isolated state mapping
    setOrderedPrice(p.orderedPrice || 0);
    setComment(p.comment || "");
    setStatus(p.status || "RESEARCH");
    setSupplier(p.supplier || "");
  };

  const triggerCopy = (text: string, fieldId: string) => {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Maps custom slash/dash date strings from sheets into HTML Standard date value format YYYY-MM-DD
  const parseSheetDateToIso = (dateStr: string): string => {
    if (!dateStr) return "";
    const clean = dateStr.trim();
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      let day = parts[0];
      let month = parts[1];
      let year = parts[2];
      if (day.length === 4) return `${day}-${month.padStart(2, '0')}-${year.padStart(2, '0')}`; // YYYY-MM-DD format
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
      comment, 
      status,
      supplier 
    });

    setLocallyCommittedIds(prev => new Set(prev).add(selectedProduct.id));

    const updated = products.map((p) =>
      p.id === selectedProduct.id ? { ...p, orderQty: inputOrderQty, orderedPrice, comment, status, supplier } : p
    );
    setProducts(updated);
    setSelectedProduct({ ...selectedProduct, orderQty: inputOrderQty, orderedPrice, comment, status, supplier });
  };

  // Window 1 Master Filtration Engine via standard HTML Native Calendar strings
  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.asin.toLowerCase().includes(searchAsin.toLowerCase()) || 
      p.name.toLowerCase().includes(searchAsin.toLowerCase());
      
    const brandMatch = !selectedBrand || p.brand === selectedBrand;
    const supplierMatch = !selectedOverviewSupplier || p.supplier === selectedOverviewSupplier;
    
    let dateMatch = true;
    if (selectedCalendarDate) {
      const parsedIso = parseSheetDateToIso(p.sourcingDateStr);
      dateMatch = parsedIso === selectedCalendarDate;
    }
    
    return matchesSearch && brandMatch && supplierMatch && dateMatch;
  });

  const pipelineFilteredProducts = products.filter((p) => {
    const hasBeenCommitted = locallyCommittedIds.has(p.id) || p.status !== "RESEARCH" || p.orderQty > 0;
    if (!hasBeenCommitted) return false;

    const matchSupplier = filterSupplier === "ALL" || p.supplier === filterSupplier;
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    return matchSupplier && matchStatus;
  });

  const formatVal = (val: any, isCurrency = false) => {
    if (val === undefined || val === null || val === "" || val === 0 || val === "0" || val === "N/A" || val === "—") {
      return "-";
    }
    if (isCurrency && typeof val === "number") {
      return `£${val.toFixed(2)}`;
    }
    return val;
  };

  if (loading) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center text-xs font-mono ${isDarkMode ? "bg-[#060814] text-white" : "bg-[#f8fafc] text-slate-900"}`}>
        LOADING INVENTORY LEDGERS...
      </div>
    );
  }

  const prodData = selectedProduct as any;

  const amazonStockSum = prodData ? ((prodData.traFba || 0) + (prodData.reservedAmz || 0) + (prodData.toAmz || 0) + (prodData.traAmz || 0)) : 0;
  const whStockSum = prodData ? ((prodData.sm67ah || 0) + (prodData.traB2b || 0) + (prodData.traBay || 0) + (prodData.webShp || 0) + (prodData.traFbm || 0)) : 0;
  const orderedStockSum = prodData ? ((prodData.rfqCount || 0) + (prodData.b2bOrdered || 0) + (prodData.orderedQty || 0) + (prodData.toWhs || 0)) : 0;

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-sans text-xs antialiased select-none transition-colors duration-200 ${
      isDarkMode ? "bg-[#060814] text-[#94a3b8]" : "bg-[#f8fafc] text-[#475569]"
    }`}>
      
      {/* SIDEBAR */}
      <aside className={`flex flex-col justify-between shrink-0 border-r transition-all duration-300 ${
        isSidebarCollapsed ? "w-[60px]" : "w-[240px]"
      } ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
        <div className="flex flex-col min-h-0">
          <div className={`p-4 flex items-center gap-3 border-b overflow-hidden ${isDarkMode ? "border-[#1e293b]" : "border-[#e2e8f0]"}`}>
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shrink-0">
              <Box size={18} />
            </div>
            {!isSidebarCollapsed && (
              <div>
                <h2 className={`font-black tracking-tight text-sm leading-none ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>
                  Transcend Ltd
                </h2>
                <p className="text-[10px] text-[#64748b] mt-1 font-medium">Order Workspace</p>
              </div>
            )}
          </div>

          <div className="p-3 space-y-1">
            <button
              onClick={() => setActiveWindow(1)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-semibold transition-all ${
                isSidebarCollapsed ? "justify-center" : "gap-3"
              } ${activeWindow === 1 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-[#f1f5f9] text-[#0f172a]") : "opacity-60 hover:opacity-100"}`}
            >
              <LayoutDashboard size={16} className="text-indigo-500 shrink-0" />
              {!isSidebarCollapsed && <span>Overview Dashboard</span>}
            </button>
            
            <button
              onClick={() => setActiveWindow(2)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-semibold transition-all ${
                isSidebarCollapsed ? "justify-center" : "gap-3"
              } ${activeWindow === 2 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-[#f1f5f9] text-[#0f172a]") : "opacity-60 hover:opacity-100"}`}
            >
              <Database size={16} className="text-emerald-500 shrink-0" />
              {!isSidebarCollapsed && <span>Supplier Pipeline</span>}
            </button>
          </div>
        </div>

        <div className={`p-3 border-t flex flex-col gap-2 ${isDarkMode ? "border-[#1e293b] bg-[#0d1527]" : "border-[#e2e8f0] bg-[#f8fafc]"}`}>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all ${
              isDarkMode ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800" : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 shadow-sm"
            }`}
          >
            {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
            {!isSidebarCollapsed && (isDarkMode ? "Day Vision" : "Night Vision")}
          </button>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center justify-center gap-2 py-1.5 text-slate-500 hover:text-slate-300 text-[10px] font-bold">
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER PLATFORM */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${isDarkMode ? "bg-[#0b0f19]/60 border-[#1e293b]" : "bg-white border-[#e2e8f0]"}`}>
          <h1 className={`text-base font-black tracking-tight ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>
            {activeWindow === 1 ? "Overview Dashboard" : "Supplier Pipeline Analytics"}
          </h1>
        </header>

        {activeWindow === 1 && (
          <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-hidden">
            
            {/* Catalog Explorer columns */}
            <div className={`w-[260px] rounded-xl border flex flex-col min-h-0 shrink-0 p-3 ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
              
              {/* NATIVE CALENDAR FILTRATION ENGINE MODULE */}
              <div className="mb-3 shrink-0">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Calendar size={11} className="text-indigo-400" /> Sourcing Date Calendar
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="date"
                    value={selectedCalendarDate}
                    onChange={(e) => setSelectedCalendarDate(e.target.value)}
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500 ${
                      isDarkMode ? "bg-[#060814] border-[#1e293b] text-white scheme-dark" : "bg-white border-[#e2e8f0] text-slate-900"
                    }`}
                  />
                  {selectedCalendarDate && (
                    <button 
                      onClick={() => setSelectedCalendarDate("")}
                      className="text-[10px] text-red-400 hover:underline font-bold px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="relative mb-2 shrink-0">
                <Search className="absolute left-3 top-3 text-[#64748b]" size={14} />
                <input
                  type="text"
                  placeholder="Search by Title, ASIN..."
                  value={searchAsin}
                  onChange={(e) => setSearchAsin(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg font-mono text-xs border focus:outline-none focus:border-indigo-500 transition-colors ${
                    isDarkMode ? "bg-[#060814] border-[#1e293b] text-white placeholder-[#475569]" : "bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a] placeholder-[#94a3b8]"
                  }`}
                />
              </div>

              <div className="space-y-1.5 mb-3 shrink-0">
                <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={`w-full border rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-[#e2e8f0] text-indigo-600"}`}>
                  <option value="">ALL BRANDS (UNFILTERED)</option>
                  {brands.map((b) => (<option key={b} value={b}>{b.toUpperCase()}</option>))}
                </select>
                <select value={selectedOverviewSupplier} onChange={(e) => setSelectedOverviewSupplier(e.target.value)} className={`w-full border rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-teal-400" : "bg-white border-[#e2e8f0] text-teal-600"}`}>
                  <option value="">ALL SUPPLIERS (UNFILTERED)</option>
                  {suppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProductToForm(p)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col ${
                      selectedProductId === p.id ? "bg-indigo-600/10 border-indigo-500 shadow-sm" : `${isDarkMode ? "bg-[#060814]/60 border-[#1e293b]/70 hover:bg-[#060814]" : "bg-[#f8fafc] border-[#e2e8f0]/80 hover:bg-white"}`
                    }`}
                  >
                    <div className="flex justify-between items-center w-full font-mono">
                      <span className={`font-black text-xs ${selectedProductId === p.id ? "text-indigo-400" : (isDarkMode ? "text-white" : "text-slate-900")}`}>
                        {p.asin}
                      </span>
                      <span className="text-[9px] text-slate-500 font-medium">{p.sourcingDateStr}</span>
                    </div>
                    <span className={`text-xs font-medium truncate w-full mt-1.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Core Single Screen Bento Workspace Layout Row Element Structure */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {selectedProduct ? (
                <>
                  {/* Row 1: Primary Metrics Header Tiles (Now Features 5 Structured Modular Blocks) */}
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 shrink-0">
                    
                    {/* TILE 1: ASIN, SKU, UPC DETAILS */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] relative group ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5 w-full">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">CONSOLIDATED IDENTIFIERS</span>
                        <a href={`https://www.amazon.co.uk/dp/${prodData.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-mono font-black">{prodData.asin} <ExternalLink size={10} /></a>
                      </div>
                      <div className="space-y-1.5 font-mono text-[11px] my-2">
                        <div className="flex items-center justify-between"><span className="text-slate-500">SKU: <strong className="text-slate-200">{prodData.sku || "—"}</strong></span>
                          <button onClick={() => triggerCopy(prodData.sku, "sku")} className="p-0.5 text-slate-500 hover:text-white bg-slate-800/40 rounded">{copiedField === "sku" ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}</button>
                        </div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">UPC: <strong className="text-slate-200">{prodData.upc || "—"}</strong></span>
                          <button onClick={() => triggerCopy(prodData.upc, "upc")} className="p-0.5 text-slate-500 hover:text-white bg-slate-800/40 rounded">{copiedField === "upc" ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}</button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900/40 p-1 rounded border border-slate-800/40"><span className="text-emerald-400 font-bold truncate">Src: {prodData.sourceCode || "N/A"}</span>
                          <button onClick={() => triggerCopy(prodData.sourceCode, "srcCode")} className="p-0.5 text-slate-500 hover:text-emerald-400 rounded">{copiedField === "srcCode" ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}</button>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-800/40 pt-1 flex justify-between">
                        <span>Brand: <strong>{prodData.brand}</strong></span>
                      </div>
                    </div>

                    {/* TILE 2: 4-TIER BSR SNAPSHOT */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block border-b border-slate-800/40 pb-1 mb-1">4-Tier Sales Rank BSR</span>
                      <div className="grid grid-cols-2 gap-2 text-center font-mono flex-1 items-center">
                        <div className="p-1 rounded bg-slate-900/50 border border-slate-800/60"><span className="text-[8px] uppercase text-slate-500 block">7D BSR</span><span className="text-xs md:text-sm font-black text-indigo-400">{prodData.bsr7d > 0 ? `#${prodData.bsr7d.toLocaleString()}` : "-"}</span></div>
                        <div className="p-1 rounded bg-slate-900/50 border border-slate-800/60"><span className="text-[8px] uppercase text-slate-500 block">30D BSR</span><span className="text-xs md:text-sm font-black text-indigo-400">{prodData.bsr30d > 0 ? `#${prodData.bsr30d.toLocaleString()}` : "-"}</span></div>
                        <div className="p-1 rounded bg-slate-900/50 border border-slate-800/60"><span className="text-[8px] uppercase text-slate-500 block">90D BSR</span><span className="text-xs md:text-sm font-black text-indigo-400">{prodData.bsr90d > 0 ? `#${prodData.bsr90d.toLocaleString()}` : "-"}</span></div>
                        <div className="p-1 rounded bg-slate-900/50 border border-slate-800/60"><span className="text-[8px] uppercase text-slate-500 block">365D BSR</span><span className="text-xs md:text-sm font-black text-indigo-400">{prodData.bsr365d > 0 ? `#${prodData.bsr365d.toLocaleString()}` : "-"}</span></div>
                      </div>
                    </div>

                    {/* TILE 3: ANALYSED PRICE MARGINS */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block border-b border-slate-800/40 pb-1">ANALYSED PRICE MARGINS</span>
                      <div className="grid grid-cols-2 gap-2 font-mono my-auto">
                        <div className="bg-slate-900/30 p-1.5 rounded border border-slate-800/40"><span className="text-slate-500 text-[8px] block uppercase">Shop</span><span className="font-black text-xs md:text-sm text-slate-100">{formatVal(prodData.shopPrice, true)}</span></div>
                        <div className="bg-slate-900/30 p-1.5 rounded border border-slate-800/40"><span className="text-slate-500 text-[8px] block uppercase">Buy VAT</span><span className="font-black text-xs md:text-sm text-red-400">{formatVal(prodData.buyPriceVat, true)}</span></div>
                        <div className="bg-slate-900/30 p-1.5 rounded border border-slate-800/40"><span className="text-slate-500 text-[8px] block uppercase">Sell Rate</span><span className="font-black text-xs md:text-sm text-emerald-400">{formatVal(prodData.sellPrice, true)}</span></div>
                        <div className="bg-slate-900/30 p-1.5 rounded border border-slate-800/40"><span className="text-slate-500 text-[8px] block uppercase">90D BB Avg</span><span className="font-black text-xs md:text-sm text-blue-400">{formatVal(prodData.bbPrice90d, true)}</span></div>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate pt-1 border-t border-dashed border-slate-800/40">Index Price: <span className="font-bold text-slate-300">{prodData.googlePrice || "N/A"}</span></div>
                    </div>

                    {/* TILE 4: BUYSHEET ATTRIBUTE MATRIX */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block border-b border-slate-800/40 pb-1">BUYSHEET ATTRIBUTE MATRIX</span>
                      <div className="grid grid-cols-2 gap-2 font-mono my-auto">
                        <div className="bg-slate-900/30 p-1 border border-slate-800/40 rounded text-center"><span className="text-slate-500 text-[8px] uppercase block">FBA / MF</span><span className="text-[11px] font-black text-slate-100">{formatVal(prodData.fbaSeller)} / {formatVal(prodData.mfSeller)}</span></div>
                        <div className="bg-slate-900/30 p-1 border border-slate-800/40 rounded text-center truncate"><span className="text-slate-500 text-[8px] uppercase block">Introduced By</span><span className="text-[11px] font-black text-indigo-400 truncate block px-1" title={prodData.introducedBy}>{formatVal(prodData.introducedBy)}</span></div>
                        <div className="bg-slate-900/30 p-1 border border-slate-800/40 rounded text-center truncate"><span className="text-slate-500 text-[8px] uppercase block">Variation</span><span className="text-[11px] font-black text-amber-400 truncate block px-1" title={prodData.variation}>{formatVal(prodData.variation)}</span></div>
                        <div className="bg-slate-900/30 p-1 border border-slate-800/40 rounded text-center"><span className="text-slate-500 text-[8px] uppercase block">Review Pct</span><span className="text-[11px] font-black text-teal-400">{prodData.reviewPct !== "-" && prodData.reviewPct !== "" ? `${prodData.reviewPct}` : "-"}</span></div>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate pt-1 border-t border-dashed border-slate-800/40">Vendor: <span className="font-bold text-slate-300">{prodData.supplier}</span></div>
                    </div>

                    {/* NEW TILE 5: YIELD STATISTICS (PROFITABILITY MATRIX & RETURN LOGICS) */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[160px] bg-gradient-to-br ${isDarkMode ? "from-emerald-950/20 to-slate-900/50 border-emerald-500/20" : "from-emerald-50/40 to-white border-emerald-200 shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block border-b border-emerald-500/20 pb-1">FINANCIAL YIELD SNAPSHOT</span>
                      
                      <div className="flex flex-col gap-2.5 my-auto font-mono text-center">
                        <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                          <span className="text-slate-500 text-[8px] uppercase block tracking-wider">Calculated Net Profit</span>
                          <span className="font-black text-lg md:text-xl text-emerald-400">{formatVal(prodData.profit, true)}</span>
                        </div>
                        <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                          <span className="text-slate-500 text-[8px] uppercase block tracking-wider">Return on Invest (ROI)</span>
                          <span className="font-black text-lg md:text-xl text-teal-400">{prodData.roiPercentage}%</span>
                        </div>
                      </div>

                      <div className="text-[8px] font-bold text-slate-500 text-center uppercase tracking-wide">
                        Live Yield Assessment Matrix
                      </div>
                    </div>

                  </div>

                  {/* Channel Sales Run Matrix Row */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                      <ShoppingCart size={14} /> 1. Channel Sales Run Matrix
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Amazon FBA</div>
                        <div className="text-xl font-black font-mono mt-1 text-white">{formatVal(prodData.sales30dFba)}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Amazon FBM</div>
                        <div className="text-xl font-black font-mono mt-1 text-white">{formatVal(prodData.sales30dFbm)}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Shopify Node</div>
                        <div className="text-xl font-black font-mono mt-1 text-white">{formatVal(prodData.sales30dShopify)}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D eBay Gateway</div>
                        <div className="text-xl font-black font-mono mt-1 text-white">{formatVal(prodData.sales30dEbay)}</div>
                      </div>
                      <div className="p-4 rounded-xl border text-center bg-indigo-600/5 border-indigo-500/30">
                        <div className="text-[9px] font-bold text-indigo-400 uppercase">7D / 14D / 30D Total</div>
                        <div className="text-xs font-black font-mono mt-2 text-indigo-400 text-center">
                          {formatVal(prodData.sales7dTotal)} | {formatVal(prodData.sales14dTotal)} | {formatVal(prodData.sales30dTotal)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Yield Snapshot Row */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                      <TrendingUp size={14} /> 2. Historical Profit Snapshot
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">7D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">{formatVal(prodData.profit7d, true)}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">14D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">{formatVal(prodData.profit14d, true)}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">{formatVal(prodData.profit30d, true)}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">90D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">{formatVal(prodData.profit90d, true)}</div>
                      </div>
                      <div className="p-4 rounded-xl border text-center bg-emerald-600/5 border-emerald-500/30">
                        <div className="text-[9px] font-bold text-emerald-400 uppercase">2025 Accumulation</div>
                        <div className="text-sm font-black font-mono text-emerald-500 mt-1.5">{formatVal(prodData.profit2025, true)}</div>
                      </div>
                      <div className="p-4 rounded-xl border text-center bg-emerald-600/5 border-emerald-500/30">
                        <div className="text-[9px] font-bold text-emerald-400 uppercase">2026 Tracking</div>
                        <div className="text-sm font-black font-mono text-emerald-500 mt-1.5">{formatVal(prodData.profit2026, true)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Stock ledger Row */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                      <Warehouse size={14} /> 3. Stock & Inventory Ledger Matrix
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className={`p-3.5 rounded-xl border ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5 mb-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Amazon Stock</span>
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Sum: {formatVal(amazonStockSum)}</span>
                        </div>
                        <div className="space-y-1 text-[10px] font-mono">
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">TRA FBA:</span><span className="font-bold text-slate-300">{formatVal(prodData.traFba)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">Reserved AMZ:</span><span className="font-bold text-slate-300">{formatVal(prodData.reservedAmz)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">TO AMZ:</span><span className="font-bold text-slate-300">{formatVal(prodData.toAmz)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">TRA AMZ:</span><span className="font-bold text-slate-300">{formatVal(prodData.traAmz)}</span></div>
                        </div>
                      </div>

                      <div className={`p-3.5 rounded-xl border ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5 mb-2">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">WH Stock</span>
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Sum: {formatVal(whStockSum)}</span>
                        </div>
                        <div className="space-y-1 text-[10px] font-mono">
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">SM6 7AH:</span><span className="font-bold text-slate-300">{formatVal(prodData.sm67ah)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">TRA B2B:</span><span className="font-bold text-slate-300">{formatVal(prodData.traB2b)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">TRA BAY:</span><span className="font-bold text-slate-300">{formatVal(prodData.traBay)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">WEB SHP:</span><span className="font-bold text-slate-300">{formatVal(prodData.webShp)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">TRA FBM:</span><span className="font-bold text-slate-300">{formatVal(prodData.traFbm)}</span></div>
                        </div>
                      </div>

                      {/* UNTOUCHED BY INPUT FORM DATA DECOUPLING MECHANISMS */}
                      <div className={`p-3.5 rounded-xl border ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5 mb-2">
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Ordered Stock</span>
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">Sum: {formatVal(orderedStockSum)}</span>
                        </div>
                        <div className="space-y-1 text-[10px] font-mono">
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">RFQ Count:</span><span className="font-bold text-slate-300">{formatVal(prodData.rfqCount)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">B2B Ordered:</span><span className="font-bold text-slate-300">{formatVal(prodData.b2bOrdered)}</span></div>
                          <div className="flex justify-between border-b border-slate-800/40 pb-0.5"><span className="text-slate-500">Ordered Qty:</span><span className="font-bold text-indigo-400">{formatVal(prodData.orderedQty)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">TO WHS:</span><span className="font-bold text-slate-300">{formatVal(prodData.toWhs)}</span></div>
                        </div>
                      </div>

                      <div className={`p-3.5 rounded-xl border ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Ordered/RFQ Details</div>
                        <p className="text-[11px] font-sans text-slate-400 italic line-clamp-4 mt-1 leading-relaxed">{prodData.rfqDetails || "No RFQ string arguments logged."}</p>
                      </div>

                      <div className={`p-3.5 rounded-xl border ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Last Purchase Details</div>
                        <div className="space-y-1 text-[10px] font-mono">
                          <div className="flex flex-col border-b border-slate-800/40 pb-1"><span className="text-[9px] text-slate-500 uppercase">Last Price:</span><span className="font-black text-emerald-400">{formatVal(prodData.lastPrice, true)}</span></div>
                          <div className="flex flex-col border-b border-slate-800/40 pb-1"><span className="text-[9px] text-slate-500 uppercase">Vendor Node:</span><span className="font-bold text-slate-300 truncate">{prodData.lastPurchasedSupplier || "N/A"}</span></div>
                          <div className="flex justify-between text-[9px] mt-1 text-slate-400"><span>Date: <strong className="text-slate-200">{prodData.lastPurchasedDate || "—"}</strong></span><span>Qty: <strong className="text-slate-200">{formatVal(prodData.qty)}</strong></span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sourcing Action Strip Container Form Section */}
                  <div className={`p-4 rounded-xl border shrink-0 bg-gradient-to-r ${isDarkMode ? "from-[#0d1527] to-[#0b0f19] border-[#1e293b]" : "from-[#f1f5f9] to-white border-[#e2e8f0] shadow-md"}`}>
                    <form onSubmit={handleSaveChanges} className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                      
                      {/* RENAMED TO ORDER QTY WITH ISOLATED INPUT VARIABLE MAPPING */}
                      <div className="w-28 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Order Qty</label>
                        <input
                          type="number"
                          value={inputOrderQty}
                          onChange={(e) => setInputOrderQty(parseInt(e.target.value) || 0)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:border-indigo-500 ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-[#e2e8f0] text-[#0f172a]"}`}
                        />
                      </div>

                      <div className="w-32 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Cost Price (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={orderedPrice}
                          onChange={(e) => setOrderedPrice(parseFloat(e.target.value) || 0)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:border-indigo-500 ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-emerald-400" : "bg-white border-[#e2e8f0] text-emerald-600"}`}
                        />
                      </div>

                      <div className="w-44 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Supplier Assignment</label>
                        <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-teal-400" : "bg-white border-[#e2e8f0] text-teal-600"}`}>
                          <option value="">SELECT SUPPLIER...</option>
                          {suppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                        </select>
                      </div>

                      <div className="w-44 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Pipeline Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={`w-full border rounded-lg px-3 py-2 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-[#e2e8f0] text-indigo-600"}`}>
                          <option value="NOT REVIEWED">NOT REVIEWED</option>
                          <option value="NOT SELECTED">NOT SELECTED</option>
                          <option value="RESEARCH">RESEARCH</option>
                          <option value="RFQ">RFQ</option>
                          <option value="PENDING">PENDING</option>
                          <option value="ORDERED">ORDERED</option>
                          <option value="CANCELLED">CANCELLED</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Internal Log Commentary</label>
                        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Log changes..." className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white placeholder-slate-700" : "bg-white border-[#e2e8f0] text-[#0f172a]"}`} />
                      </div>
                      
                      <button type="submit" className="md:self-end h-9 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-lg shadow-lg uppercase text-[10px] tracking-wider">
                        <Save size={14} /> Commit Changes
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className={`p-12 text-center rounded-xl border flex-1 flex flex-col items-center justify-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b] text-slate-500" : "bg-white border-[#e2e8f0] text-slate-400 shadow-sm"}`}>
                  Select an ASIN entry from the explorer mapping pane to begin.
                </div>
              )}
            </div>

          </div>
        )}

        {/* WORKSPACE MODULE 2: SUPPLIER PIPELINE WINDOW */}
        {activeWindow === 2 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 p-4 overflow-y-auto custom-scrollbar">
            
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center gap-4 ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
              <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-wider"><Filter size={14} /> Pipeline Filters:</div>
              <div className="w-full md:w-52">
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">By Sourcing Vendor</label>
                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={`w-full border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-[#e2e8f0] text-slate-900"}`}>
                  <option value="ALL">ALL VENDORS</option>
                  {suppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                </select>
              </div>
              <div className="w-full md:w-52">
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">By Tracking Lane</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`w-full border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-[#e2e8f0] text-slate-900"}`}>
                  <option value="ALL">ALL TRACKING LANES</option>
                  <option value="NOT REVIEWED">NOT REVIEWED</option>
                  <option value="NOT SELECTED">NOT SELECTED</option>
                  <option value="RESEARCH">RESEARCH</option>
                  <option value="RFQ">RFQ</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ORDERED">ORDERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className="text-[11px] font-medium text-slate-400 ml-auto">
                Total Matches: <span className="text-emerald-400 font-bold">{pipelineFilteredProducts.length}</span> entries
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col min-h-0 ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className={`uppercase text-[9px] tracking-wider border-b ${isDarkMode ? "bg-[#060814] text-slate-400 border-slate-900" : "bg-[#f8fafc] text-slate-500 border-[#e2e8f0]"}`}>
                      <th className="p-3">ASIN</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Supplier</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Units Committed</th>
                      <th className="p-3 text-right">Cost Price</th>
                      <th className="p-3 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? "divide-slate-800/60" : "divide-slate-100"}`}>
                    {pipelineFilteredProducts.length > 0 ? (
                      pipelineFilteredProducts.map((p) => {
                        const totalValue = (p.orderQty || 0) * (p.orderedPrice || 0);
                        return (
                          <tr key={p.id} className={`transition-colors ${isDarkMode ? "hover:bg-[#060814]/40" : "hover:bg-[#f8fafc]"}`}>
                            <td className="p-3 font-bold text-indigo-400">{p.asin}</td>
                            <td className="p-3 max-w-xs truncate text-slate-400 font-sans">{p.name}</td>
                            <td className="p-3 text-center font-bold text-teal-500">{p.supplier || "—"}</td>
                            <td className="p-3 text-center">
                              <span className="text-[10px] px-2 py-0.5 rounded font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{p.status}</span>
                            </td>
                            <td className="p-3 text-center font-bold">{p.orderQty || 0} pcs</td>
                            <td className="p-3 text-right">£{(p.orderedPrice || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-emerald-500">£{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-sans italic">
                          No product lanes match parameters or have been committed during this active workspace layout sequence.
                        </td>
                      </tr>
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