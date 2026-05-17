"use client";

import React, { useState, useEffect } from "react";
import { getDashboardData, updateProductOperations, FullProductMetricSuite } from "./actions";
import { 
  Sun, Moon, Search, Save, Box, LayoutDashboard, Database,
  TrendingUp, DollarSign, Warehouse, ShoppingCart, Activity, Filter
} from "lucide-react";

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeWindow, setActiveWindow] = useState<1 | 2>(1);
  const [products, setProducts] = useState<FullProductMetricSuite[]>([]);
  const [searchAsin, setSearchAsin] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<FullProductMetricSuite | null>(null);

  // Form State parameters (Window 1)
  const [orderQty, setOrderQty] = useState(0);
  const [orderedPrice, setOrderedPrice] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<any>("RESEARCH");
  const [supplier, setSupplier] = useState("PHCT"); // Added interactive form supplier configuration

  // Pipeline Filter Matrix States (Window 2)
  const [filterSupplier, setFilterSupplier] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    getDashboardData().then((res) => {
      setProducts(res.products);
      if (res.products.length > 0) {
        loadProductToForm(res.products[0]);
      }
    });
  }, []);

  const loadProductToForm = (p: FullProductMetricSuite) => {
    setSelectedProduct(p);
    setOrderQty(p.orderQty || 0);
    setOrderedPrice(p.orderedPrice || 0);
    setComment(p.comment || "");
    setStatus(p.status || "RESEARCH");
    setSupplier(p.supplier || "PHCT");
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    // Send updated parameters upstream to Server Actions
    await updateProductOperations(selectedProduct.id, { 
      orderQty, 
      orderedPrice, 
      comment, 
      status,
      supplier // Persisted through action mapping
    });

    const updated = products.map((p) =>
      p.id === selectedProduct.id ? { ...p, orderQty, orderedPrice, comment, status, supplier } : p
    );
    setProducts(updated);
  };

  // Window 1 Search Processing 
  const filteredProducts = products.filter((p) =>
    p.asin.toLowerCase().includes(searchAsin.toLowerCase()) ||
    p.name.toLowerCase().includes(searchAsin.toLowerCase())
  );

  // Window 2 Core Matrix Filtering Engine
  const pipelineFilteredProducts = products.filter((p) => {
    const matchSupplier = filterSupplier === "ALL" || p.supplier === filterSupplier;
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    return matchSupplier && matchStatus;
  });

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-sans text-xs antialiased select-none transition-colors duration-200 ${
      isDarkMode ? "bg-[#060814] text-[#94a3b8]" : "bg-[#f8fafc] text-[#475569]"
    }`}>
      
      {/* LEFT GLOBAL NAVIGATION SIDEBAR */}
      <aside className={`w-[240px] flex flex-col justify-between shrink-0 border-r transition-all ${
        isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"
      }`}>
        <div className="flex flex-col min-h-0">
          <div className={`p-4 flex items-center gap-3 border-b ${isDarkMode ? "border-[#1e293b]" : "border-[#e2e8f0]"}`}>
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
              <Box size={18} />
            </div>
            <div>
              <h2 className={`font-black tracking-tight text-sm leading-none ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>
                Transcend Ltd
              </h2>
              <p className="text-[10px] text-[#64748b] mt-1 font-medium">Order Management</p>
            </div>
          </div>

          <div className="p-3 space-y-1">
            <div className="text-[10px] font-bold text-[#64748b] px-2.5 py-1 tracking-wider uppercase">NAVIGATION</div>
            <button
              onClick={() => setActiveWindow(1)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-semibold transition-all ${
                activeWindow === 1 
                  ? (isDarkMode ? "bg-[#1e293b] text-white font-bold" : "bg-[#f1f5f9] text-[#0f172a] font-bold")
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <LayoutDashboard size={16} className="text-indigo-500" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveWindow(2)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-semibold transition-all ${
                activeWindow === 2 
                  ? (isDarkMode ? "bg-[#1e293b] text-white font-bold" : "bg-[#f1f5f9] text-[#0f172a] font-bold")
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <Database size={16} className="text-emerald-500" />
              <span>Supplier Pipeline</span>
            </button>
          </div>
        </div>

        <div className={`p-4 border-t flex flex-col gap-3 ${isDarkMode ? "border-[#1e293b] bg-[#0d1527]" : "border-[#e2e8f0] bg-[#f8fafc]"}`}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black">DA</div>
            <div>
              <div className={`font-bold text-xs ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>Demo Admin</div>
              <div className="text-[10px] text-[#64748b] font-medium mt-0.5">(Admin)</div>
            </div>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold transition-all ${
              isDarkMode ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800" : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 shadow-sm"
            }`}
          >
            {isDarkMode ? <><Sun size={13} /> Day Vision</> : <><Moon size={13} /> Night Vision</>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? "bg-[#0b0f19]/60 border-[#1e293b]" : "bg-white border-[#e2e8f0]"
        }`}>
          <div>
            <h1 className={`text-base font-black tracking-tight ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>
              {activeWindow === 1 ? "Overview Dashboard" : "Supplier Pipeline Analytics"}
            </h1>
            <p className="text-[11px] text-[#64748b] mt-0.5 font-medium">Enterprise asset routing metrics and real-time ledger filters.</p>
          </div>
        </header>

        {/* WORKSPACE MODULE 1: BENTO OVERVIEW */}
        {activeWindow === 1 && (
          <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-hidden">
            
            {/* Catalog list sidebar column */}
            <div className={`w-[260px] rounded-xl border flex flex-col min-h-0 shrink-0 p-3 ${
              isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"
            }`}>
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-3 text-[#64748b]" size={14} />
                <input
                  type="text"
                  placeholder="Filter by Title, ASIN..."
                  value={searchAsin}
                  onChange={(e) => setSearchAsin(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-lg font-mono text-xs border focus:outline-none focus:border-indigo-500 transition-colors ${
                    isDarkMode ? "bg-[#060814] border-[#1e293b] text-white placeholder-[#475569]" : "bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a] placeholder-[#94a3b8]"
                  }`}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProductToForm(p)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col ${
                      selectedProduct?.id === p.id
                        ? "bg-indigo-600/10 border-indigo-500 shadow-sm"
                        : `${isDarkMode ? "bg-[#060814]/60 border-[#1e293b]/70 hover:bg-[#060814]" : "bg-[#f8fafc] border-[#e2e8f0]/80 hover:bg-white"}`
                    }`}
                  >
                    <div className="flex justify-between items-center w-full font-mono">
                      <span className={`font-black text-xs ${selectedProduct?.id === p.id ? "text-indigo-400" : (isDarkMode ? "text-white" : "text-slate-900")}`}>
                        {p.asin}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-md font-black tracking-wide ${
                        p.status === "ORDERED" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                      }`}>{p.status}</span>
                    </div>
                    <span className={`text-xs font-medium truncate w-full mt-1.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{p.name}</span>
                    <div className="text-[10px] text-[#64748b] font-mono flex justify-between mt-2 pt-2 border-t border-dashed border-slate-800/40">
                      <span>STOCK: <strong className="text-indigo-400 font-bold">{p.totalStock ?? 0}</strong></span>
                      <span className="font-bold text-slate-400">{p.supplier}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Core Single Screen Bento Workspace */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {selectedProduct ? (
                <>
                  {/* Row 1: Primary Metrics Header Tiles */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[90px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block">Identified ASIN Asset</span>
                      <span className={`text-xl font-black font-mono tracking-tight ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>{selectedProduct.asin}</span>
                      <span className="text-[11px] font-semibold text-indigo-400 truncate">{selectedProduct.brand} Matrix</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[90px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block">System SKU Identifier</span>
                      <span className={`text-lg font-black font-mono truncate tracking-tight ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>{selectedProduct.sku || "NONE ASSIGNED"}</span>
                      <span className="text-[11px] font-medium text-slate-400">UPC: {selectedProduct.upc || "—"}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[90px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Net Realized Profit Margin</span>
                      <span className="text-2xl font-black text-emerald-500 font-mono tracking-tight">£{selectedProduct.profit ?? "0.00"}</span>
                      <span className="text-[11px] text-amber-500 font-black">ROI Check: {selectedProduct.roiPercentage}%</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[90px] ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Total Integrated Stock</span>
                      <span className={`text-2xl font-black font-mono tracking-tight ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>
                        {selectedProduct.totalStock ?? 0} <span className="text-xs font-normal text-slate-500">Units</span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">{selectedProduct.supplier} Route Matrix</span>
                    </div>
                  </div>

                  {/* Row 2: Channel Sales Run Matrix */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                      <ShoppingCart size={14} /> 1. Channel Sales Run Matrix
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Amazon FBA</div>
                        <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedProduct.sales30dFba}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Amazon FBM</div>
                        <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedProduct.sales30dFbm}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Shopify Node</div>
                        <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedProduct.sales30dShopify}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D eBay Gateway</div>
                        <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedProduct.sales30dEbay}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center bg-indigo-600/5 ${isDarkMode ? "border-indigo-500/30" : "border-indigo-200"}`}>
                        <div className="text-[9px] font-bold text-indigo-400 uppercase">7D / 14D / 30D Total</div>
                        <div className="text-xs font-black font-mono mt-2 text-indigo-400">
                          {selectedProduct.sales7dTotal} | {selectedProduct.sales14dTotal} | {selectedProduct.sales30dTotal}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Yield Profit Snapshot */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                      <TrendingUp size={14} /> 2. Net Realized Yield Profit Snapshot
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">7D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">£{selectedProduct.profit7d}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">14D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">£{selectedProduct.profit14d}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">30D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">£{selectedProduct.profit30d}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">90D Profit</div>
                        <div className="text-lg font-black font-mono text-emerald-400 mt-1">£{selectedProduct.profit90d}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center bg-emerald-600/5 ${isDarkMode ? "border-emerald-500/30" : "border-emerald-200"}`}>
                        <div className="text-[9px] font-bold text-emerald-400 uppercase">2025 Accumulation</div>
                        <div className="text-sm font-black font-mono text-emerald-500 mt-1.5">£{selectedProduct.profit2025}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center bg-emerald-600/5 ${isDarkMode ? "border-emerald-500/30" : "border-emerald-200"}`}>
                        <div className="text-[9px] font-bold text-emerald-400 uppercase">2026 Tracking</div>
                        <div className="text-sm font-black font-mono text-emerald-500 mt-1.5">£{selectedProduct.profit2026}</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Pricing Model Nodes */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-2 mb-2 px-1 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                      <Warehouse size={14} /> 3. Asset Allocation and Pricing Model Nodes
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">Amazon Managed FBA</div>
                        <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedProduct.amazonStock} <span className="text-xs font-normal">Pcs</span></div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">Inbound Wh Pipeline</div>
                        <div className="text-xl font-black font-mono text-amber-500 mt-1">{selectedProduct.toWhStock} <span className="text-xs font-normal">Pcs</span></div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">Gross Buy Cost (VAT inc)</div>
                        <div className={`text-xl font-black font-mono mt-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>£{selectedProduct.buyPriceVat}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                        <div className="text-[9px] font-bold text-slate-500 uppercase">Active Retail Sell Price</div>
                        <div className="text-xl font-black font-mono text-emerald-400 mt-1">£{selectedProduct.sellPrice}</div>
                      </div>
                      <div className={`p-4 rounded-xl border text-center bg-amber-600/5 ${isDarkMode ? "border-amber-500/30" : "border-amber-200"}`}>
                        <div className="text-[9px] font-bold text-amber-400 uppercase">Transit Floor Days</div>
                        <div className="text-xl font-black font-mono text-amber-400 mt-1">{selectedProduct.daysInWhSinceLastPurchase ?? 0} Days</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: Multi-Supplier Targets */}
                  <div className={`p-4 rounded-xl border shrink-0 ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                    <div className="flex items-center gap-2 mb-3 text-teal-400 font-bold uppercase tracking-wider text-[10px]">
                      <Activity size={14} /> 4. Competitive Multi-Supplier Price Sourcing Targets (10-Day Bounds)
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
                      <div className={`p-3 rounded-xl border ${isDarkMode ? "bg-[#060814] border-[#1e293b]" : "bg-[#f8fafc] border-[#e2e8f0]"}`}>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">Sourcing Base Rate</div>
                        <div className="text-lg font-black text-indigo-400 mt-0.5">£{selectedProduct.sourcingPrice10d}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-1">Vendor: {selectedProduct.sourcingSupplier}</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${isDarkMode ? "bg-[#060814] border-[#1e293b]" : "bg-[#f8fafc] border-[#e2e8f0]"}`}>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">PHCT Metric Floor</div>
                        <div className={`text-lg font-black mt-0.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>£{selectedProduct.phctMinPrice10d}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-1">Sec: £{selectedProduct.phctSecondMinPrice10d}</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${isDarkMode ? "bg-[#060814] border-[#1e293b]" : "bg-[#f8fafc] border-[#e2e8f0]"}`}>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">ABC Registry Record</div>
                        <div className="text-lg font-black text-emerald-400 mt-0.5">£{selectedProduct.abcMinPrice10d}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-1">Node: {selectedProduct.abcMinSupplier}</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${isDarkMode ? "bg-[#060814] border-[#1e293b]" : "bg-[#f8fafc] border-[#e2e8f0]"}`}>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">UK Distributor Min</div>
                        <div className="text-lg font-black text-teal-400 mt-0.5">£{selectedProduct.ukMinPrice10d}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-1">Node: {selectedProduct.ukMinSupplier}</div>
                      </div>
                      <div className={`p-3 rounded-xl border ${isDarkMode ? "bg-[#060814] border-[#1e293b]" : "bg-[#f8fafc] border-[#e2e8f0]"}`}>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">Live Sales BSR Rank</div>
                        <div className="text-lg font-black text-amber-500 mt-0.5">#{selectedProduct.combinedCurrentBsr}</div>
                        <div className="text-[10px] text-slate-400 mt-1">30D Avg: {selectedProduct.bsr30d}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sourcing Action Strip Container */}
                  <div className={`p-4 rounded-xl border shrink-0 bg-gradient-to-r ${
                    isDarkMode ? "from-[#0d1527] to-[#0b0f19] border-[#1e293b]" : "from-[#f1f5f9] to-white border-[#e2e8f0] shadow-md"
                  }`}>
                    <form onSubmit={handleSaveChanges} className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                      <div className="w-28 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Ordered Qty</label>
                        <input
                          type="number"
                          value={orderQty}
                          onChange={(e) => setOrderQty(parseInt(e.target.value) || 0)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:border-indigo-500 ${
                            isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-[#e2e8f0] text-[#0f172a]"
                          }`}
                        />
                      </div>
                      <div className="w-32 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Cost Price (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={orderedPrice}
                          onChange={(e) => setOrderedPrice(parseFloat(e.target.value) || 0)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:border-indigo-500 ${
                            isDarkMode ? "bg-[#060814] border-[#1e293b] text-emerald-400" : "bg-white border-[#e2e8f0] text-emerald-600"
                          }`}
                        />
                      </div>

                      {/* REQUESTED UPDATE: SUPPLIER SELECTOR ASSIGNED NEXT TO COST */}
                      <div className="w-36 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Supplier Assignment</label>
                        <select
                          value={supplier}
                          onChange={(e) => setSupplier(e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-xs font-black focus:outline-none focus:border-indigo-500 ${
                            isDarkMode ? "bg-[#060814] border-[#1e293b] text-teal-400" : "bg-white border-[#e2e8f0] text-teal-600"
                          }`}
                        >
                          <option value="PHCT">PHCT MATRIX</option>
                          <option value="ABC">ABC TRACKER</option>
                          <option value="UK">UK DISTRIBUTOR</option>
                          <option value="Other">OTHER NODE</option>
                        </select>
                      </div>

                      <div className="w-36 shrink-0">
                        <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-1">Pipeline Status</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                          className={`w-full border rounded-lg px-3 py-2 text-xs font-black focus:outline-none focus:border-indigo-500 ${
                            isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-[#e2e8f0] text-indigo-600"
                          }`}
                        >
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
                        <input
                          type="text"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Log changes, delivery identifiers or tracking details..."
                          className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                            isDarkMode ? "bg-[#060814] border-[#1e293b] text-white placeholder-slate-700" : "bg-white border-[#e2e8f0] text-[#0f172a] placeholder-[#94a3b8]"
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        className="md:self-end h-9 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all uppercase text-[10px] tracking-wider"
                      >
                        <Save size={14} /> Commit Changes
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className={`p-12 text-center rounded-xl border flex-1 flex flex-col items-center justify-center ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b] text-slate-500" : "bg-white border-[#e2e8f0] text-slate-400 shadow-sm"}`}>
                  Select an ASIN entry from the column catalog explorer mapping pane to begin.
                </div>
              )}
            </div>

          </div>
        )}

        {/* WORKSPACE MODULE 2: RESTRUCTURED SUPPLIER PIPELINE WITH WORKING SEARCH MATRIX */}
        {activeWindow === 2 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 p-4 overflow-y-auto custom-scrollbar">
            
            {/* REQUESTED UPDATE: ADVANCED SEARCH FILTERS CONTROL BANNER */}
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center gap-4 ${
              isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"
            }`}>
              <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-wider">
                <Filter size={14} /> Matrix Filters:
              </div>
              
              <div className="w-full md:w-52">
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">By Sourcing Vendor</label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-[#e2e8f0] text-slate-900"
                  }`}
                >
                  <option value="ALL">ALL VENDORS (SHOW GLOBAL)</option>
                  <option value="PHCT">PHCT</option>
                  <option value="ABC">ABC</option>
                  <option value="UK">UK DISTRIBUTOR</option>
                </select>
              </div>

              <div className="w-full md:w-52">
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">By Pipeline Tracking Lane</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none ${
                    isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-[#e2e8f0] text-slate-900"
                  }`}
                >
                  <option value="ALL">ALL TRACKING LANES</option>
                  <option value="RESEARCH">RESEARCH</option>
                  <option value="RFQ">RFQ</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ORDERED">ORDERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <div className="text-[11px] font-medium text-slate-400 ml-auto pt-4 md:pt-0">
                Found <span className="text-indigo-400 font-bold">{pipelineFilteredProducts.length}</span> corresponding rows matching parameter matrices
              </div>
            </div>

            {/* Micro horizontal lanes value totals */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
              {["RESEARCH", "RFQ", "PENDING", "ORDERED", "CANCELLED"].map((st) => {
                const count = pipelineFilteredProducts.filter((p) => p.status === st).length;
                const totalUnits = pipelineFilteredProducts.filter((p) => p.status === st).reduce((acc, curr) => acc + (curr.orderQty || 0), 0);
                return (
                  <div key={st} className={`p-4 rounded-xl border ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
                    <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">{st} LANE</div>
                    <div className={`text-xl font-black mt-1 ${isDarkMode ? "text-white" : "text-[#0f172a]"}`}>
                      {count} <span className="text-xs font-normal text-slate-500">Products</span>
                    </div>
                    <div className="text-indigo-500 font-mono font-bold text-xs mt-1">{totalUnits.toLocaleString()} Pcs Filtered</div>
                  </div>
                );
              })}
            </div>

            {/* Core Itemized Results Table */}
            <div className={`p-4 rounded-xl border flex flex-col min-h-0 ${isDarkMode ? "bg-[#0b0f19] border-[#1e293b]" : "bg-white border-[#e2e8f0] shadow-sm"}`}>
              <h3 className={`text-xs font-black uppercase tracking-wider mb-3 pb-2 border-b ${isDarkMode ? "border-slate-800 text-white" : "border-slate-100 text-[#0f172a]"}`}>
                Filtered Sourcing Registry Item Log Base
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className={`uppercase text-[9px] tracking-wider border-b ${isDarkMode ? "bg-[#060814] text-slate-400 border-slate-900" : "bg-[#f8fafc] text-slate-500 border-[#e2e8f0]"}`}>
                      <th className="p-3">ASIN Asset Identification</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Assigned Supplier</th>
                      <th className="p-3 text-center">Workflow Lane</th>
                      <th className="p-3 text-center">Units Committed</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Calculated Total Value</th>
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
                            <td className="p-3 text-center font-bold text-teal-500">{p.supplier}</td>
                            <td className="p-3 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wide ${
                                p.status === "ORDERED" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                              }`}>{p.status}</span>
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
                          No product entries correspond with your active dropdown selection parameters.
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