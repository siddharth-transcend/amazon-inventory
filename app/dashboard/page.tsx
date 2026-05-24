"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { getDashboardData, updateProductOperations, FullProductMetricSuite } from "./actions";
import { 
  Sun, Moon, Search, CheckCircle2, Box, LayoutDashboard, Database,
  Warehouse, ShoppingCart, Filter, ExternalLink,
  Copy, Check, ChevronLeft, ChevronRight, Calendar, Download, AlertTriangle, TrendingUp, Link2
} from "lucide-react";
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
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
  const [isPending, startTransition] = useTransition();

  // Brand / Supplier Interactive Text Query Filter States
  const [brandSearchInput, setBrandSearchInput] = useState("");
  const [supplierSearchInput, setSupplierSearchInput] = useState("");

  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedOverviewSupplier, setSelectedOverviewSupplier] = useState<string>("");
  
  // Pipeline filter lanes
  const [pipelineFilterDate, setPipelineFilterDate] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>("ALL");
  const [filterBrand, setFilterBrand] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Input fields form states
  const [inputOrderQty, setInputOrderQty] = useState<number>(0);
  const [orderedPrice, setOrderedPrice] = useState<number>(0);
  const [targetQty, setTargetQty] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<any>("RFQ");
  const [sourceUrl, setSourceUrl] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(""); 
  const [dateOrderedStr, setDateOrderedStr] = useState("");

  // Clean Application Level Custom Modal Intercept States
  const [customModalConfig, setCustomModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", description: "", onConfirm: () => {} });

  const [selectedProductRowIds, setSelectedProductRowIds] = useState<Set<string>>(new Set());
  const [locallyCommittedIds, setLocallyCommittedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getDashboardData();
        setProducts(res.products as any);
        if (res.products.length > 0) {
          loadProductToForm(res.products[0] as any);
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
    setStatus(p.status || "RFQ");
    // Completely remove setSupplier and assign it directly to your existing selectedProduct state fields inline:
if (p) {
  p.sourceUrl = p.sourceUrl || "";
}
    setSupplierReference(p.supplierReference || "");
    setPurchaseOrderNumber((p as any).purchaseOrderNumber || "");
    
    if (p.dateOrderedStr) {
      if (p.dateOrderedStr.includes("-")) {
        setDateOrderedStr(p.dateOrderedStr);
      } else {
        setDateOrderedStr(parseFormattedStringDateToIso(p.dateOrderedStr));
      }
    } else {
      setDateOrderedStr("");
    }
  };

  const getTodayIsoString = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseFormattedStringDateToIso = (str: string): string => {
    if (!str) return "";
    const clean = str.trim();
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      let day = parts[0];
      let month = parts[1];
      let year = parts[2];
      if (day.length === 4) return clean; 
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return "";
  };

  const formatIsoStringToDisplay = (isoStr: string): string => {
    if (!isoStr || !isoStr.includes("-")) return isoStr;
    const parts = isoStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const triggerCopy = (text: string, fieldId: string) => {
    if (!text || text === "-" || text === "—" || text === "N/A") return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const parseSheetDateToIso = (dateStr: string): string => {
    return parseFormattedStringDateToIso(dateStr);
  };

  const handleOverviewFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomModalConfig({
      isOpen: true,
      title: "Confirm Overview Updates",
      description: "Are you sure you want to save changes to this product record?",
      onConfirm: () => executeOverviewSave()
    });
  };

  const executeOverviewSave = async () => {
    if (!selectedProduct) return;
    
    const displayFormattedDateStr = formatIsoStringToDisplay(dateOrderedStr);

    startTransition(async () => {
      await updateProductOperations(selectedProduct.id, { 
        orderQty: inputOrderQty, 
        orderedPrice, 
        targetQty,
        targetPrice,
        comment, 
        status,
        supplier: selectedProduct?.supplier || "Unknown", // UPDATED LINE
        supplierReference,
        purchaseOrderNumber,
        dateOrderedStr: displayFormattedDateStr
      });
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
        supplier: selectedProduct?.supplier || "Unknown", // UPDATED LINE 
        supplierReference,
        purchaseOrderNumber,
        dateOrderedStr: displayFormattedDateStr
      } : p
    );
    setProducts(updated);
    
    const matched = updated.find(p => p.id === selectedProduct.id);
    if (matched) setSelectedProduct(matched);
    
    setCustomModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleInlineStatusChange = (productId: string, nextStatus: any) => {
    setCustomModalConfig({
      isOpen: true,
      title: "Update Status Tracking?",
      description: `Confirm changing tracking phase parameter to ${nextStatus}?`,
      onConfirm: async () => {
        let additionalUpdates: any = { status: nextStatus };
        let finalDisplayDate = "";
        
        if (nextStatus === "ORDERED") {
          finalDisplayDate = formatIsoStringToDisplay(getTodayIsoString());
          additionalUpdates.dateOrderedStr = finalDisplayDate;
        }

        setProducts(prev => prev.map((p) => {
          if (p.id === productId) {
            return { ...p, status: nextStatus, ...(nextStatus === "ORDERED" ? { dateOrderedStr: finalDisplayDate } : {}) };
          }
          return p;
        }));

        await updateProductOperations(productId, additionalUpdates);
        setCustomModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleInlineNumberBlur = async (productId: string, key: 'orderQty' | 'orderedPrice' | 'targetQty' | 'targetPrice', numericVal: number) => {
    await updateProductOperations(productId, { [key]: numericVal });
  };

  const handleInlineStringBlur = async (productId: string, key: 'supplierReference' | 'comment' | 'purchaseOrderNumber' | 'dateOrderedStr', valueStr: string) => {
    let finalValue = valueStr;
    if (key === 'dateOrderedStr') {
      finalValue = formatIsoStringToDisplay(valueStr);
    }
    await updateProductOperations(productId, { [key]: finalValue });
  };

  const toggleSelectRow = (rowId: string) => {
    const next = new Set(selectedProductRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    setSelectedProductRowIds(next);
  };

  const baseFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.asin.toLowerCase().includes(searchAsin.toLowerCase()) || p.name.toLowerCase().includes(searchAsin.toLowerCase());
      const matchDate = !selectedCalendarDate || selectedCalendarDate === "" || parseSheetDateToIso(p.sourcingDateStr) === selectedCalendarDate;
      return matchesSearch && matchDate;
    });
  }, [products, searchAsin, selectedCalendarDate]);

  const dynamicRelevantBrands = useMemo(() => {
    const subset = baseFilteredProducts.map(p => p.brand).filter(Boolean);
    return Array.from(new Set(subset)).filter(b => b.toLowerCase().includes(brandSearchInput.toLowerCase()));
  }, [baseFilteredProducts, brandSearchInput]);

  const dynamicRelevantSuppliers = useMemo(() => {
    const subset = baseFilteredProducts.map(p => p.sourceUrl).filter(Boolean);
    return Array.from(new Set(subset)).filter(s => s.toLowerCase().includes(supplierSearchInput.toLowerCase()));
  }, [baseFilteredProducts, supplierSearchInput]);

  const uniqueBrandsAll = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const uniqueSuppliersAll = useMemo(() => Array.from(new Set(products.map(p => p.supplier).filter(Boolean))), [products]);

  const finalFilteredOverviewProducts = useMemo(() => {
    return baseFilteredProducts.filter((p) => {
      const brandMatch = !selectedBrand || p.brand.toLowerCase() === selectedBrand.toLowerCase();
      const supplierMatch = !selectedOverviewSupplier || p.sourceUrl.toLowerCase() === selectedOverviewSupplier.toLowerCase();
      return brandMatch && supplierMatch;
    });
  }, [baseFilteredProducts, selectedBrand, selectedOverviewSupplier]);

  const pipelineFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      const hasBeenCommitted = locallyCommittedIds.has(p.id) || p.isConfirmedForPipeline;
      if (!hasBeenCommitted) return false;

      const matchSupplier = filterSupplier === "ALL" || p.supplier === filterSupplier;
      const matchBrand = filterBrand === "ALL" || p.brand === filterBrand;
      const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
      const matchDate = !pipelineFilterDate || parseSheetDateToIso(p.sourcingDateStr) === pipelineFilterDate;
      
      let matchQuery = true;
      if (pipelineSearch.trim()) {
        const q = pipelineSearch.toLowerCase().trim();
        matchQuery = p.asin.toLowerCase().includes(q) || p.upc.toLowerCase().includes(q) || (p.supplierReference && p.supplierReference.toLowerCase().includes(q)) || ((p as any).purchaseOrderNumber && (p as any).purchaseOrderNumber.toLowerCase().includes(q));
      }
      return matchSupplier && matchBrand && matchStatus && matchDate && matchQuery;
    });
  }, [products, filterSupplier, filterBrand, filterStatus, pipelineFilterDate, pipelineSearch, locallyCommittedIds]);
  
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
    const fileRows = pipelineFilteredProducts.map((p, index) => {
      const rawUpc = (p.upc || "").replace(/[^0-9]/g, "");
      const formattedUpc = rawUpc ? rawUpc.padStart(13, "0").slice(-13) : "";
      
      return [
        index + 1,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${formattedUpc}"`,
        `"${p.sourceCode || "N/A"}"`,
        p.targetQty || 0,
        (p.orderedPrice || 0).toFixed(2),
        (p.targetPrice || 0).toFixed(2),
        "" 
      ];
    });

    const csvContentString = "data:text/csv;charset=utf-8," + [tableHeaders.join("\t"), ...fileRows.map(e => e.join("\t"))].join("\n");
    const structuredBlobUri = encodeURI(csvContentString);
    const hiddenTriggerElement = document.createElement("a");
    hiddenTriggerElement.setAttribute("href", structuredBlobUri);
    hiddenTriggerElement.setAttribute("download", `Pipeline_Ledger_${new Date().toISOString().split('T')[0]}.xls`);
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
      
      {/* DIRECT APPLICATION-LEVEL MODAL */}
      {customModalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs flex items-center justify-center animate-fadeIn">
          <div className={`p-6 rounded-2xl border max-w-sm w-full mx-4 shadow-2xl ${isDarkMode ? 'bg-[#0b0f19] border-slate-800' : 'bg-white border-slate-300'}`}>
            <div className="flex items-center gap-3 text-indigo-500 mb-3">
              <AlertTriangle size={24} className="text-indigo-600" />
              <h3 className={`text-sm font-black tracking-tight ${themeHeadingText}`}>{customModalConfig.title}</h3>
            </div>
            <p className={`text-xs leading-relaxed font-medium mb-5 ${themeTextSubtitle}`}>
              {customModalConfig.description}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setCustomModalConfig(prev => ({ ...prev, isOpen: false }))} className={`px-4 py-2 rounded-xl text-xs font-bold ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:bg-slate-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Cancel</button>
              <button type="button" onClick={customModalConfig.onConfirm} className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md uppercase tracking-wider"><CheckCircle2 size={14} /> Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`flex flex-col justify-between shrink-0 border-r transition-all duration-300 ${isSidebarCollapsed ? "w-[60px]" : "w-[240px]"} ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-slate-300 shadow-md"}`}>
        <div className="flex flex-col min-h-0">
          <div className={`p-4 flex items-center gap-3 border-b overflow-hidden ${isDarkMode ? "border-[#1e293b]" : "border-slate-200"}`}>
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shrink-0">
              <Box size={18} />
            </div>
            {!isSidebarCollapsed && (
              <div>
                <h2 className={`font-black tracking-tight text-sm leading-none ${themeHeadingText}`}>Transcend Ltd</h2>
                <p className="text-[10px] mt-1 font-bold text-slate-500">Workspace Control</p>
              </div>
            )}
          </div>

          <div className="p-3 space-y-1">
            <button type="button" onClick={() => setActiveWindow(1)} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-bold transition-all ${isSidebarCollapsed ? "justify-center" : "gap-3"} ${activeWindow === 1 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-indigo-50 text-indigo-950 border border-indigo-200") : "opacity-75 hover:opacity-100"}`}>
              <LayoutDashboard size={16} className="text-indigo-600 shrink-0" />
              {!isSidebarCollapsed && <span>Overview Dashboard</span>}
            </button>
            <button type="button" onClick={() => setActiveWindow(2)} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-bold transition-all ${isSidebarCollapsed ? "justify-center" : "gap-3"} ${activeWindow === 2 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-emerald-50 text-emerald-950 border border-emerald-200") : "opacity-75 hover:opacity-100"}`}>
              <Database size={16} className="text-emerald-600 shrink-0" />
              {!isSidebarCollapsed && <span>Supplier Pipeline</span>}
            </button>
          </div>
        </div>

        <div className={`p-3 border-t flex flex-col gap-2 ${isDarkMode ? "border-[#1e293b] bg-[#0d1527]" : "border-slate-200 bg-slate-50"}`}>
          <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all ${isDarkMode ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800" : "bg-white border-slate-300 text-slate-900 shadow-sm hover:bg-slate-100"}`}>
            {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
            {!isSidebarCollapsed && (isDarkMode ? "Day Vision" : "Night Vision")}
          </button>
          <button type="button" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center justify-center gap-2 py-1.5 text-slate-500 hover:text-slate-800 text-[10px] font-bold">
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* CORE WORKSPACE MODULE CONTAINER */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        
        {/* RESTRUCTURED HEADER CONTAINING THE REQUESTED FILTERS */}
        <header className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b shrink-0 ${isDarkMode ? "bg-[#0b0f19]/60 border-[#1e293b]" : "bg-white border-slate-300 shadow-sm"}`}>
          <div className="flex items-center gap-3">
            <h1 className={`text-sm md:text-base font-black tracking-tight ${themeHeadingText}`}>
              {activeWindow === 1 ? "Overview Dashboard" : "Supplier Pipeline Table Management"}
            </h1>
          </div>

          {/* DYNAMIC FILTERS NEXT TO OVERVIEW DASHBOARD TEXT */}
          {activeWindow === 1 && (
            <div className="flex flex-wrap items-center gap-3 bg-slate-500/5 p-1 rounded-xl border border-slate-400/10">
              
              {/* Sourcing Date Filter Box */}
              <div className="flex items-center gap-1.5 px-2 py-1 border-r border-slate-400/20">
                <Calendar size={13} className="text-indigo-600" />
                <input 
                  type="date" 
                  value={selectedCalendarDate} 
                  onChange={(e) => setSelectedCalendarDate(e.target.value)} 
                  className={`border rounded-md px-2 py-1 text-xs font-mono font-bold focus:outline-none ${themeInputBg}`} 
                />
                {selectedCalendarDate && (
                  <button type="button" onClick={() => setSelectedCalendarDate("")} className="text-[10px] text-red-600 hover:underline font-black px-1">Clear</button>
                )}
              </div>

              {/* Dynamic Brand Discovery Dropdown */}
              <div className="flex items-center gap-1 px-2 border-r border-slate-400/20">
                <select 
                  value={selectedBrand} 
                  onChange={(e) => setSelectedBrand(e.target.value)} 
                  className={`border rounded-md px-2 py-1 text-xs font-bold focus:outline-none min-w-[140px] ${isDarkMode ? "bg-[#060814] text-indigo-400 border-slate-800" : "bg-white text-indigo-950 font-black border-slate-400"}`}
                >
                  <option value="">ALL BRANDS ({dynamicRelevantBrands.length})</option>
                  {dynamicRelevantBrands.map((b) => (<option key={b} value={b}>{b.toUpperCase()}</option>))}
                </select>
              </div>

              {/* Dynamic Supplier Discovery Dropdown */}
              <div className="flex items-center gap-1 px-2">
                <select 
                  value={selectedOverviewSupplier} 
                  onChange={(e) => setSelectedOverviewSupplier(e.target.value)} 
                  className={`border rounded-md px-2 py-1 text-xs font-bold focus:outline-none min-w-[155px] ${isDarkMode ? "bg-[#060814] text-teal-400 border-slate-800" : "bg-white text-teal-950 font-black border-slate-400"}`}
                >
                  <option value="">ALL SUPPLIERS ({dynamicRelevantSuppliers.length})</option>
                  {dynamicRelevantSuppliers.map((s) => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                </select>
              </div>

            </div>
          )}

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
            
            {/* LEFT COMPACT SEARCH PANEL */}
            <div className={`w-[260px] rounded-xl border flex flex-col min-h-0 shrink-0 p-3 ${themeCardBg}`}>
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                <input type="text" placeholder="Search ASIN / Title..." value={searchAsin} onChange={(e) => setSearchAsin(e.target.value)} className={`w-full pl-9 pr-3 py-2 rounded-lg font-mono text-xs border focus:outline-none focus:border-indigo-500 ${themeInputBg}`} />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
                <input type="text" placeholder="Filter brand..." value={brandSearchInput} onChange={(e) => setBrandSearchInput(e.target.value)} className={`pl-2 pr-1 py-1 rounded text-[10px] border focus:outline-none ${themeInputBg}`} />
                <input type="text" placeholder="Filter supp..." value={supplierSearchInput} onChange={(e) => setSupplierSearchInput(e.target.value)} className={`pl-2 pr-1 py-1 rounded text-[10px] border focus:outline-none ${themeInputBg}`} />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {finalFilteredOverviewProducts.map((p) => (
                  <button type="button" key={p.id} onClick={() => loadProductToForm(p)} className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col ${selectedProductId === p.id ? "bg-indigo-600/10 border-indigo-600 shadow-sm" : `${isDarkMode ? "bg-[#060814]/60 border-[#1e293b]/70 hover:bg-[#060814]" : "bg-slate-50 border-slate-200 hover:bg-white"}`}`}>
                    <div className="flex justify-between items-center w-full font-mono">
                      <span className={`font-black text-xs ${selectedProductId === p.id ? "text-indigo-600" : (isDarkMode ? "text-white" : "text-slate-950")}`}>{p.asin}</span>
                      <span className="text-[9px] font-bold text-slate-500">{p.sourcingDateStr}</span>
                    </div>
                    <span className={`text-xs font-bold truncate w-full mt-1.5 ${themeTextSubtitle}`}>{p.name}</span>
                  </button>
                ))}
                {finalFilteredOverviewProducts.length === 0 && (
                  <div className="text-center p-4 italic text-slate-500">No parameters mapped matching filters.</div>
                )}
              </div>
            </div>

            {/* MAIN DATA MODULE DISPLAY FRAME */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {selectedProduct ? (
                <>
                  {/* 1. TOP SECTION: Identifiers and Yield Matrices */}
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 shrink-0">
                    
                    {/* CONSOLIDATED IDENTIFIERS WITH MULTI-COPY CHANNELS */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[175px] ${themeCardBg}`}>
                      <span className={`text-[10px] font-black uppercase block border-b border-slate-400/30 pb-1.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-950"}`}>CONSOLIDATED IDENTIFIERS</span>
                      
                      <div className="space-y-1.5 font-mono text-[11px] my-1.5">
                        <div className="flex items-center justify-between bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/20">
                          <span className={`font-bold flex items-center gap-1.5 ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>
                            ASIN: <a href={`https://www.amazon.co.uk/dp/${prodData.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-black hover:underline flex items-center gap-0.5">{prodData.asin} <ExternalLink size={9} /></a>
                          </span>
                          <button type="button" onClick={() => triggerCopy(prodData.asin, "asin")} className={`p-1 rounded transition-all ${isDarkMode ? "bg-slate-800/60 text-slate-200 hover:bg-slate-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>{copiedField === "asin" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}</button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-500/5 px-2 py-1 rounded border border-slate-400/20">
                          <span className={themeTextMuted}>SKU: <strong className={isDarkMode ? "text-slate-200" : "text-slate-950 font-black"}>{prodData.sku || "—"}</strong></span>
                          <button type="button" onClick={() => triggerCopy(prodData.sku, "sku")} className={`p-1 rounded transition-all ${isDarkMode ? "bg-slate-800/60 text-slate-200 hover:bg-slate-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>{copiedField === "sku" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}</button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-500/5 px-2 py-1 rounded border border-slate-400/20">
                          <span className={themeTextMuted}>UPC: <strong className={isDarkMode ? "text-slate-200" : "text-slate-950 font-black"}>{prodData.upc || "—"}</strong></span>
                          <button type="button" onClick={() => triggerCopy(prodData.upc, "upc")} className={`p-1 rounded transition-all ${isDarkMode ? "bg-slate-800/60 text-slate-200 hover:bg-slate-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>{copiedField === "upc" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}</button>
                        </div>
                        <div className="flex items-center justify-between bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/20">
                          <span className="text-emerald-600 font-black truncate">Src: {prodData.sourceCode || "N/A"}</span>
                          <button type="button" onClick={() => triggerCopy(prodData.sourceCode, "sourceCode")} className={`p-1 rounded transition-all ${isDarkMode ? "bg-slate-800/60 text-slate-200 hover:bg-slate-700" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>{copiedField === "sourceCode" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}</button>
                        </div>
                      </div>
                      <div className="text-[11px] border-t border-dashed border-slate-400/30 pt-1.5 text-slate-500 font-bold">
                        Brand: 
                        <div className={`text-base font-black tracking-tight leading-tight mt-0.5 ${isDarkMode ? "text-indigo-300" : "text-indigo-950"}`}>{prodData.brand?.toUpperCase()}</div>
                      </div>
                    </div>

                    {/* CONSOLIDATED LIVE SHEET OPERATIONS & METRICS WITH ADDED REQUESTED VALUES */}
                    <div className={`xl:col-span-3 p-4 rounded-xl border flex flex-col justify-between min-h-[175px] ${themeCardBg}`}>
                      <div className="flex items-center justify-between border-b border-slate-400/30 pb-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? "text-[#38bdf8]" : "text-slate-950"}`}>
                          CONSOLIDATED LIVE SHEET OPERATIONS & FINANCIAL METRICS
                        </span>
                        {prodData.sourceUrl && prodData.sourceUrl !== "N/A" && prodData.sourceUrl !== "—" ? (
  <a 
    href={prodData.sourceUrl} 
    target="_blank" 
    rel="noopener noreferrer" 
    className="text-base font-extrabold tracking-tight text-indigo-400 hover:text-indigo-300 hover:underline transition-colors block"
  >
    {prodData.sourceUrl}
  </a>
) : (
  <span className="text-base font-extrabold tracking-tight text-slate-500 italic block">
    No Source URL Attached
  </span>
)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 My-3 font-mono">
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Live Avail Qty</span>
                          <span className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-950"}`}>{formatVal(prodData.liveAvailableQty)}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Live Buy Price</span>
                          <span className="font-black text-sm text-indigo-600">{formatVal(prodData.livePrice, true)}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Shop Price</span>
                          <span className={`font-black text-sm ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>{formatVal(prodData.shopPrice, true)}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Buy Price + VAT</span>
                          <span className="font-black text-sm text-amber-600">{formatVal(prodData.buyPriceVat, true)}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Sell Price Target</span>
                          <span className="font-black text-sm text-emerald-600">{formatVal(prodData.sellPrice, true)}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">90D BB Avg</span>
                          <span className="font-black text-sm text-blue-600">{formatVal(prodData.bbPrice90d, true)}</span>
                        </div>
                        {/* New Display Parameters: FBA Seller Count */}
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-indigo-950/20 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
                          <span className="text-indigo-500 text-[8px] block uppercase font-black">FBA Seller</span>
                          <span className="font-black text-sm text-indigo-600">{formatVal(prodData.fbaSeller || prodData.fbaSellerCount)}</span>
                        </div>
                        {/* New Display Parameters: MF Seller Count */}
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-teal-950/20 border-teal-500/20" : "bg-teal-50 border-teal-200"}`}>
                          <span className="text-teal-500 text-[8px] block uppercase font-black">MF Seller</span>
                          <span className="font-black text-sm text-teal-600">{formatVal(prodData.mfSeller || prodData.mfSellerCount)}</span>
                        </div>
                        {/* VARIATION FIELD IN EXACT SAME STYLE */}
<div className={`p-2 rounded border text-center ${isDarkMode ? "bg-teal-950/20 border-teal-500/20" : "bg-teal-50 border-teal-200"}`}>
  <span className="text-teal-500 text-[8px] block uppercase font-black">Variation</span>
  <span className="font-black text-sm text-teal-600 truncate block max-w-full" title={prodData.variation}>
    {prodData.variation || "-"}
  </span>
</div>

{/* VARIATION REVIEW % FIELD IN EXACT SAME STYLE */}
<div className={`p-2 rounded border text-center ${isDarkMode ? "bg-teal-950/20 border-teal-500/20" : "bg-teal-50 border-teal-200"}`}>
  <span className="text-teal-500 text-[8px] block uppercase font-black">Variation Review %</span>
  <span className="font-black text-sm text-teal-600">
    {prodData.reviewPct || "-"}
  </span>
</div>
                      </div>

                      <div className="flex justify-between items-center bg-emerald-500/5 rounded-xl border border-emerald-500/20 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold uppercase text-[9px]">Calculated Yield Profit:</span>
                          <span className="font-black text-sm text-emerald-600">{formatVal(prodData.profit, true)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold uppercase text-[9px]">ROI Yield Percentage:</span>
                          <span className="font-black text-sm text-indigo-600">{prodData.roiPercentage ? `${prodData.roiPercentage.toFixed(1)}%` : "-"}</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1">
                          <span className="text-slate-500 text-[9px] uppercase font-bold">Market price signature:</span>
                          <span className={`font-mono font-black ${isDarkMode ? "text-slate-300" : "text-slate-900"}`}>{prodData.googlePrice || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* BUY SHEET BSR PERFORMANCE MATRIX TILE */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[175px] ${themeCardBg}`}>
                      <div className="border-b border-slate-400/30 pb-1.5 flex items-center gap-1 text-indigo-500">
                        <TrendingUp size={12} />
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? "text-indigo-400" : "text-indigo-950"}`}>
                          BUY SHEET BSR MATRIX
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 font-mono my-2 text-center">
                        <div className={`p-1.5 border rounded ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">7 Day BSR</span>
                          <span className={`text-xs font-black ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>{prodData.bsr7d ? prodData.bsr7d.toLocaleString() : "-"}</span>
                        </div>
                        <div className={`p-1.5 border rounded ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">30 Day BSR</span>
                          <span className={`text-xs font-black ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>{prodData.bsr30d ? prodData.bsr30d.toLocaleString() : "-"}</span>
                        </div>
                        <div className={`p-1.5 border rounded ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">90 Day BSR</span>
                          <span className={`text-xs font-black ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>{prodData.bsr90d ? prodData.bsr90d.toLocaleString() : "-"}</span>
                        </div>
                        <div className={`p-1.5 border rounded ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">365 Day BSR</span>
                          <span className={`text-xs font-black ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>{prodData.bsr365d ? prodData.bsr365d.toLocaleString() : "-"}</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 font-medium pt-1.5 border-t border-dashed border-slate-400/30 flex justify-between">
                        <span>Introduced By:</span>
                        <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-950"}`}>{prodData.introducedBy || "N/A"}</span>
                      </div>
                    </div>

                  </div>

                  {/* ZOHO PERFORMANCE SALES VELOCITY DATA PANEL */}
<div className={`p-4 rounded-xl border flex flex-col justify-between h-full ${themeCardBg}`}>
  <div className="border-b border-slate-400/30 pb-2 mb-4 flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
      <TrendingUp size={12} /> 📊 Live Channels Velocity &amp; Gross Profit Suite
    </span>
    <span className="text-[9px] font-bold text-slate-500 font-mono">ASIN Lookup Sync Active</span>
  </div>
  
  {/* Expanded 5-Column Grid Matrix for Uniform Desktop Distribution */}
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 font-mono my-auto py-1">
    
    {/* 3D Segment */}
    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[115px] transition-all shadow-xs ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
    }`}>
      <span className="text-slate-500 text-[9px] block uppercase font-bold tracking-wider">3D Units</span>
      <span className={`font-black text-2xl my-1 tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
        {formatVal(prodData.zohoUnits3d)}
      </span>
      <div className="border-t border-slate-500/10 pt-1 mt-1">
        <span className="text-[8px] block text-slate-400 font-medium">3D Profit</span>
        <span className="font-extrabold text-sm text-emerald-500">{formatVal(prodData.zohoProfit3d, true)}</span>
      </div>
    </div>
    
    {/* 7D Segment */}
    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[115px] transition-all shadow-xs ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
    }`}>
      <span className="text-slate-500 text-[9px] block uppercase font-bold tracking-wider">7D Units</span>
      <span className={`font-black text-2xl my-1 tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
        {formatVal(prodData.zohoUnits7d)}
      </span>
      <div className="border-t border-slate-500/10 pt-1 mt-1">
        <span className="text-[8px] block text-slate-400 font-medium">7D Profit</span>
        <span className="font-extrabold text-sm text-emerald-500">{formatVal(prodData.zohoProfit7d, true)}</span>
      </div>
    </div>

    {/* 30D Segment */}
    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[115px] transition-all shadow-sm ${
      isDarkMode ? "bg-indigo-950/30 border-indigo-500/30" : "bg-indigo-50/50 border-indigo-200"
    }`}>
      <span className="text-indigo-500 text-[9px] block uppercase font-black tracking-wider">30D Units</span>
      <span className="font-black text-2xl my-1 tracking-tight text-indigo-400">
        {formatVal(prodData.zohoUnits30d)}
      </span>
      <div className="border-t border-indigo-500/10 pt-1 mt-1">
        <span className="text-[8px] block text-indigo-400/70 font-medium">30D Profit</span>
        <span className="font-extrabold text-sm text-emerald-500">{formatVal(prodData.zohoProfit30d, true)}</span>
      </div>
    </div>

    {/* 90D Segment */}
    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[115px] transition-all shadow-xs ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
    }`}>
      <span className="text-slate-500 text-[9px] block uppercase font-bold tracking-wider">90D Units</span>
      <span className={`font-black text-2xl my-1 tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
        {formatVal(prodData.zohoUnits90d)}
      </span>
      <div className="border-t border-slate-500/10 pt-1 mt-1">
        <span className="text-[8px] block text-slate-400 font-medium">90D Profit</span>
        <span className="font-extrabold text-sm text-emerald-500">{formatVal(prodData.zohoProfit90d, true)}</span>
      </div>
    </div>

    {/* 2026 Year-to-Date Segment (Now integrated right next to 90D Tile) */}
    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[115px] transition-all shadow-sm ${
      isDarkMode ? "bg-amber-950/30 border-amber-500/30" : "bg-amber-50 border-amber-200"
    }`}>
      <span className="text-amber-500 text-[9px] block uppercase font-black tracking-wider">2026 YTD Units</span>
      <span className="font-black text-2xl my-1 tracking-tight text-amber-500">
        {formatVal(prodData.zohoUnits2026)}
      </span>
      <div className="border-t border-amber-500/20 pt-1 mt-1">
        <span className="text-[8px] block text-amber-400/70 font-medium">YTD Profit</span>
        <span className="font-extrabold text-sm text-emerald-500">{formatVal(prodData.zohoProfit2026, true)}</span>
      </div>
    </div>

  
</div>


                    {/* ZOHO HISTORICAL SOURCING TRENDS DATA PANEL */}
<div className={`p-4 rounded-xl border flex flex-col justify-between ${themeCardBg}`}>
  {/* Header component */}
  <div className="border-b border-slate-400/30 pb-2 mb-4 flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-wider text-teal-500 flex items-center gap-1.5">
      <Link2 size={12} /> 📊 Historical Sourcing &amp; Supplier Pricing Landscapes
    </span>
    <span className="text-[9px] font-bold text-slate-500 font-mono">Competitor Cost Discovery</span>
  </div>
  
  {/* TOP ROW: Core Marketplaces (3 Large Feature Columns) */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
    {/* PHCT Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[90px] ${
      isDarkMode ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/40 border-indigo-100"
    }`}>
      <span className="text-[9px] font-black tracking-wider text-indigo-400 uppercase">PHCT Marketplace</span>
      <span className="text-lg font-black my-1 text-slate-200">
        {formatVal(prodData.phctMinPrice, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate max-w-full">
        🏭 {prodData.phctMinSupplier || "-"}
      </span>
    </div>

    {/* ABC Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[90px] ${
      isDarkMode ? "bg-teal-950/20 border-teal-900/50" : "bg-teal-50/40 border-teal-100"
    }`}>
      <span className="text-[9px] font-black tracking-wider text-teal-400 uppercase">ABC Channels</span>
      <span className="text-lg font-black my-1 text-slate-200">
        {formatVal(prodData.abcMinPrice, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate max-w-full">
        🏭 {prodData.abcMinSupplier || "-"}
      </span>
    </div>

    {/* United Kingdom Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[90px] ${
      isDarkMode ? "bg-amber-950/20 border-amber-900/50" : "bg-amber-50/40 border-amber-100"
    }`}>
      <span className="text-[9px] font-black tracking-wider text-amber-400 uppercase">United Kingdom Core</span>
      <span className="text-lg font-black my-1 text-slate-200">
        {formatVal(prodData.ukMinPrice, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate max-w-full">
        🏭 {prodData.ukMinSupplier || "-"}
      </span>
    </div>
  </div>

  <div className={`border-t border-dashed my-2 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`} />

  {/* BOTTOM ROW: Chronological Historical Rolling Intervals (4 Analytics Columns) */}
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
    {/* 10D Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[85px] ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/50 border-slate-100"
    }`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">10 Days Rolling</span>
      <span className="text-base font-extrabold text-indigo-400 my-0.5">
        {formatVal(prodData.priceMin10d, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate">
        👤 {prodData.supplierMin10d || "-"}
      </span>
    </div>

    {/* 30D Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[85px] ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/50 border-slate-100"
    }`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">30 Days Rolling</span>
      <span className="text-base font-extrabold text-indigo-400 my-0.5">
        {formatVal(prodData.priceMin30d, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate">
        👤 {prodData.supplierMin30d || "-"}
      </span>
    </div>

    {/* 90D Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[85px] ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/50 border-slate-100"
    }`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">90 Days Rolling</span>
      <span className="text-base font-extrabold text-indigo-400 my-0.5">
        {formatVal(prodData.priceMin90d, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate">
        👤 {prodData.supplierMin90d || "-"}
      </span>
    </div>

    {/* 330D Box */}
    <div className={`p-3 border rounded-xl flex flex-col justify-between min-h-[85px] ${
      isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/50 border-slate-100"
    }`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">330 Days Rolling</span>
      <span className="text-base font-extrabold text-indigo-400 my-0.5">
        {formatVal(prodData.priceMin330d, true)}
      </span>
      <span className="text-[10px] font-medium text-slate-400 truncate">
        👤 {prodData.supplierMin330d || "-"}
      </span>
    </div>
  </div>

                    

                  </div>

                    {/* INVENTORY LEDGER MATRIX */}
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1 text-amber-600 font-black uppercase text-[10px] tracking-wider"><Warehouse size={14} /> 2. Inventory Ledger Matrix</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className={`p-4 rounded-xl border text-sm ${themeCardBg}`}>
                          <div className="flex justify-between items-center border-b border-slate-400/30 pb-2 mb-2.5">
                            <span className="font-black text-indigo-500 uppercase text-xs">Amazon Stock</span>
                            <span className="font-black font-mono text-xs px-2.5 py-1 rounded bg-indigo-100 text-indigo-950 border border-indigo-200">Sum: {formatVal(amazonStockSum)}</span>
                          </div>
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>TRA FBA:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.traFba)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>Reserved AMZ:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.reservedAmz)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>TO AMZ:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.toAmz)}</span></div>
                            <div className="flex justify-between"><span className={themeTextMuted}>TRA AMZ:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.traAmz)}</span></div>
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border text-sm ${themeCardBg}`}>
                          <div className="flex justify-between items-center border-b border-slate-400/30 pb-2 mb-2.5">
                            <span className="font-black text-emerald-500 uppercase text-xs">Warehouse Node Stock</span>
                            <span className="font-black font-mono text-xs px-2.5 py-1 rounded bg-emerald-100 text-emerald-950 border border-emerald-200">Sum: {formatVal(whStockSum)}</span>
                          </div>
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>SM6 7AH:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.sm67ah)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>TRA B2B:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.traB2b)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>TRA BAY:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.traBay)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>WEB SHP:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.webShp)}</span></div>
                            <div className="flex justify-between"><span className={themeTextMuted}>TRA FBM:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.traFbm)}</span></div>
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border text-sm ${themeCardBg}`}>
                          <div className="flex justify-between items-center border-b border-slate-400/30 pb-2 mb-2.5">
                            <span className="font-black text-teal-500 uppercase text-xs">Operational Active Pipeline</span>
                            <span className="font-black font-mono text-xs px-2.5 py-1 rounded bg-teal-100 text-teal-950 border border-teal-200">Sum: {formatVal(orderedStockSum)}</span>
                          </div>
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>RFQ Count:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.rfqCount)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>B2B Ordered:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.b2bOrdered)}</span></div>
                            <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className={themeTextMuted}>Ordered Qty:</span><span className="font-black text-sm text-indigo-600 dark:text-indigo-400">{formatVal(prodData.orderedQty)}</span></div>
                            <div className="flex justify-between"><span className={themeTextMuted}>TO WHS:</span><span className={`font-black text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{formatVal(prodData.toWhs)}</span></div>
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border text-sm flex flex-col justify-between ${themeCardBg}`}>
                          <div>
                            <div className="text-xs font-black text-emerald-500 uppercase border-b border-slate-400/30 pb-2 mb-2">Last Purchase Details</div>
                            <div className="space-y-1.5 font-mono text-xs">
                              <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className="text-slate-500 font-bold uppercase text-[10px]">Last Price:</span><span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{prodData.lastPrice ? (prodData.lastPrice).toFixed(2) : "-"}</span></div>
                              <div className="flex justify-between border-b border-slate-400/20 pb-1"><span className="text-slate-500 font-bold uppercase text-[10px]">Vendor:</span><span className={`font-black max-w-[120px] truncate text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>{prodData.lastPurchasedSupplier || "N/A"}</span></div>
                              <div className="flex justify-between text-[10px] text-slate-400"><span>Date Linked:</span><span className="font-bold">{prodData.lastPurchasedDate || "—"}</span></div>
                            </div>
                          </div>
                          <div className="bg-amber-500/5 rounded-lg border border-amber-500/10 p-1.5 flex items-center justify-between text-[11px] font-mono mt-2">
                            <span className="text-slate-500 font-bold">Total Stock Node:</span>
                            <span className="font-black text-amber-600 text-xs">{formatVal(prodData.totalStock)} pcs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. BOTTOM SECTION: FULL-WIDTH EXPANDED INTERACTIVE OPERATIONS WORKBENCH CONTROL PANEL */}
<div className="w-full mt-6">
  <form onSubmit={handleOverviewFormSubmit} className={`p-5 rounded-xl border flex flex-col gap-4 w-full shadow-sm ${themeCardBg}`}>
    <div className="flex items-center gap-2 text-indigo-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-400/20 pb-2">
      <CheckCircle2 size={14} /> Interactive Live Sheet Operations Workbench Control
    </div>

    {/* Input Control Element Stream Configuration */}
    <div className="w-full flex flex-col gap-4">
      
      {/* ROW 1: Expanded Wide Input Layout Fields */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <div className="md:col-span-1 flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">
            Active Sourcing Vendor / Source URL
          </label>
          <input 
            type="text" 
            placeholder="Vendor URL parameter..." 
            value={selectedProduct?.sourceUrl || ""} 
            onChange={(e) => {
              if (selectedProduct) {
                setSelectedProduct({
                  ...selectedProduct,
                  sourceUrl: e.target.value
                });
              }
            }} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Supplier Reference Code</label>
          <input 
            type="text" 
            placeholder="Ref code..." 
            value={supplierReference} 
            onChange={(e) => setSupplierReference(e.target.value)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">PO Number</label>
          <input 
            type="text" 
            placeholder="PO tag..." 
            value={purchaseOrderNumber} 
            onChange={(e) => setPurchaseOrderNumber(e.target.value)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Date Ordered</label>
          <input 
            type="date" 
            value={dateOrderedStr} 
            onChange={(e) => setDateOrderedStr(e.target.value)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg} ${!isDarkMode ? "scheme-light" : "scheme-dark"}`} 
          />
        </div>
      </div>

      {/* ROW 2: Uniform Metrics Grid Blocks & Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-end border-t border-slate-400/10 pt-4 w-full">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Target Qty</label>
          <input 
            type="number" 
            value={targetQty} 
            onChange={(e) => setTargetQty(parseInt(e.target.value) || 0)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Target Price</label>
          <input 
            type="number" 
            step="0.01" 
            value={targetPrice} 
            onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Order Qty</label>
          <input 
            type="number" 
            value={inputOrderQty} 
            onChange={(e) => setInputOrderQty(parseInt(e.target.value) || 0)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Ordered Price</label>
          <input 
            type="number" 
            step="0.01" 
            value={orderedPrice} 
            onChange={(e) => setOrderedPrice(parseFloat(e.target.value) || 0)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono font-black focus:outline-none ${themeInputBg}`} 
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Pipeline Status</label>
          <select 
            value={status} 
            onChange={(e) => {
              const nextStatus = e.target.value;
              setStatus(nextStatus);
              if (nextStatus === "ORDERED") {
                setDateOrderedStr(getTodayIsoString());
              }
            }} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-slate-400 text-indigo-950"}`}
          >
            <option value="NOT REVIEWED">NOT REVIEWED</option>
            <option value="NOT SELECTED">NOT SELECTED</option>
            <option value="RFQ">RFQ</option>
            <option value="PENDING TO ORDER">PENDING TO ORDER</option>
            <option value="ORDERED">ORDERED</option>
            <option value="COLLECTED">COLLECTED</option>
            <option value="INVOICED">INVOICED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-500 block">Internal Log Commentary</label>
          <input 
            type="text" 
            placeholder="Type notes..." 
            value={comment} 
            onChange={(e) => setComment(e.target.value)} 
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-bold focus:outline-none ${themeInputBg}`} 
          />
        </div>
      </div>

      {/* ROW 3: Full Length Action button trigger formatting */}
      <div className="pt-2 flex justify-start">
        <button 
          type="submit" 
          disabled={isPending} 
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider text-white shadow-md transition-all ${
            isPending ? "bg-slate-600" : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]"
          }`}
        >
          {isPending ? "Saving..." : "Commit Data Row"}
        </button>
      </div>

    </div>
  </form>
</div>
                </>
              ) : (
                <div className="text-center p-12 bg-white rounded-xl border border-dashed text-slate-500 italic">Select an available parameter item code from left drawer list panel to launch telemetry analytics views.</div>
              )}
            </div>

          </div>
        )}

        {/* WINDOW 2 MODULE (SUPPLIER PIPELINE DATA TABLE GRID LEDGER) */}
        {activeWindow === 2 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 p-4 overflow-y-auto custom-scrollbar">
            
            <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 ${themeCardBg}`}>
              <div className="flex items-center gap-2 text-indigo-500 font-black uppercase text-[10px] tracking-wider shrink-0"><Filter size={14} /> Pipeline Engines:</div>
              
              <div className="w-full lg:w-44">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Unified Query Matrix Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                  <input type="text" placeholder="ASIN/UPC/PO tags..." value={pipelineSearch} onChange={(e) => setPipelineSearch(e.target.value)} className={`w-full pl-8 pr-2 py-1 rounded border text-xs focus:outline-none font-mono font-bold ${themeInputBg}`} />
                </div>
              </div>

              <div className="w-full lg:w-32">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Sourcing Date Filter</label>
                <input type="date" value={pipelineFilterDate} onChange={(e) => setPipelineFilterDate(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-mono font-bold focus:outline-none ${themeInputBg} ${!isDarkMode ? "scheme-light" : "scheme-dark"}`} />
              </div>

              <div className="w-full lg:w-40">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">By Brand Node</label>
                <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL BRANDS</option>
                  {uniqueBrandsAll.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="w-full lg:w-40">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">By Supplier Node</label>
                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL SUPPLIERS</option>
                  {uniqueSuppliersAll.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="w-full lg:w-36">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Filter Phase status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL LIFECYCLES</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="RFQ">RFQ</option>
                  <option value="PENDING TO ORDER">PENDING TO ORDER</option>
                  <option value="ORDERED">ORDERED</option>
                  <option value="COLLECTED">COLLECTED</option>
                  <option value="INVOICED">INVOICED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div className="ml-auto pt-3 flex items-center gap-2">
                <button type="button" onClick={triggerExcelSpreadsheetDownload} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] flex items-center gap-1.5 tracking-wider shadow-sm"><Download size={13} /> Export Ledger (.XLS)</button>
              </div>
            </div>

            {/* MASTER SPREADSHEET TABLE GRID */}
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
                      <th className="p-3">Source Code</th>
                      <th className="p-3">Product Name Title</th>
                      <th className="p-3 text-center">Supplier Node</th>
                      <th className="p-3 text-center">Supplier Reference</th>
                      <th className="p-3 text-center">Purchase Order (PO)</th>
                      <th className="p-3 text-center">Date Ordered</th>
                      <th className="p-3 text-center">Target Qty</th>
                      <th className="p-3 text-center">Target Price</th>
                      <th className="p-3 text-center">Units Committed</th>
                      <th className="p-3 text-right">Cost Price</th>
                      <th className="p-3 text-right">Net Profit</th>
                      <th className="p-3 text-center">Pipeline Status</th>
                      <th className="p-3">Internal Log Commentary</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? "divide-slate-800/60" : "divide-slate-300"}`}>
                    {pipelineFilteredProducts.length > 0 ? (
                      pipelineFilteredProducts.map((p) => {
                        return (
                          <tr key={p.id} className={`transition-colors ${isDarkMode ? "hover:bg-[#060814]/40" : "hover:bg-slate-50"}`}>
                            <td className="p-2 text-center">
                              <input type="checkbox" checked={selectedProductRowIds.has(p.id)} onChange={() => toggleSelectRow(p.id)} className="rounded cursor-pointer" />
                            </td>
                            <td className="p-2 font-bold text-indigo-600"><a href={`https://www.amazon.co.uk/dp/${p.asin}`} target="_blank" rel="noreferrer" className="hover:underline">{p.asin}</a></td>
                            <td className="p-2 text-slate-400">{p.upc || "—"}</td>
                            <td className="p-2 font-bold text-emerald-600">{p.sourceCode || "—"}</td>
                            <td className="p-2 max-w-[200px] truncate text-slate-500 font-sans font-medium" title={p.name}>{p.name}</td>
                            <td className="p-2 text-center">
                              <input type="text" defaultValue={p.supplier || ""} onBlur={(e) => handleInlineStringBlur(p.id, 'comment', `SUPPLIER: ${e.target.value} | ${p.comment}`)} className={`w-28 px-2 py-0.5 text-center text-xs border rounded ${themeInputBg}`} />
                            </td>
                            <td className="p-2 text-center">
                              <input type="text" defaultValue={p.supplierReference || ""} onBlur={(e) => handleInlineStringBlur(p.id, 'supplierReference', e.target.value)} className={`w-24 px-2 py-0.5 text-center text-xs border rounded ${themeInputBg}`} />
                            </td>
                            <td className="p-2 text-center">
                              <input type="text" defaultValue={(p as any).purchaseOrderNumber || ""} onBlur={(e) => handleInlineStringBlur(p.id, 'purchaseOrderNumber', e.target.value)} className={`w-24 px-2 py-0.5 text-center text-xs border rounded ${themeInputBg}`} />
                            </td>
                            <td className="p-2 text-center">
                              <input type="date" defaultValue={p.dateOrderedStr ? parseFormattedStringDateToIso(p.dateOrderedStr) : ""} onBlur={(e) => handleInlineStringBlur(p.id, 'dateOrderedStr', e.target.value)} className={`px-1 py-0.5 border rounded text-xs ${themeInputBg}`} />
                            </td>
                            <td className="p-2 text-center font-bold">{p.targetQty || 0}</td>
                            <td className="p-2 text-center font-bold text-indigo-500">£{(p.targetPrice || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <input type="number" defaultValue={p.orderQty || 0} onBlur={(e) => handleInlineNumberBlur(p.id, 'orderQty', parseInt(e.target.value) || 0)} className={`w-14 px-1 py-0.5 border rounded text-center text-xs font-bold ${themeInputBg}`} />
                            </td>
                            <td className="p-2 text-center">
                              <input type="number" step="0.01" defaultValue={p.orderedPrice || 0} onBlur={(e) => handleInlineNumberBlur(p.id, 'orderedPrice', parseFloat(e.target.value) || 0)} className={`w-18 px-1 py-0.5 border rounded text-center text-xs font-mono font-bold ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-amber-400" : "bg-white border-slate-400 text-amber-700"}`} />
                            </td>
                            <td className="p-2 text-right font-bold text-emerald-600">£{((p.orderQty || 0) * (p.profit || 0)).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <select value={p.status || "RFQ"} onChange={(e) => handleInlineStatusChange(p.id, e.target.value)} className={`text-xs px-1 py-0.5 rounded border font-black ${isDarkMode ? "bg-slate-900 border-slate-800 text-indigo-400" : "bg-white border-slate-300 text-indigo-950"}`}>
                                <option value="NOT REVIEWED">NOT REVIEWED</option>
                                <option value="NOT SELECTED">NOT SELECTED</option>
                                <option value="RFQ">RFQ</option>
                                <option value="PENDING TO ORDER">PENDING TO ORDER</option>
                                <option value="ORDERED">ORDERED</option>
                                <option value="COLLECTED">COLLECTED</option>
                                <option value="INVOICED">INVOICED</option>
                                <option value="CANCELLED">CANCELLED</option>
                                <option value="CLOSED">CLOSED</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input type="text" defaultValue={p.comment || ""} onBlur={(e) => handleInlineStringBlur(p.id, 'comment', e.target.value)} placeholder="Log note..." className={`w-full min-w-[150px] px-2 py-0.5 text-xs border rounded ${themeInputBg}`} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={16} className="p-8 text-center text-slate-500 font-sans font-bold italic">No rows match layout filters.</td></tr>
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