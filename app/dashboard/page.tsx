"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { getDashboardData, updateProductOperations, createProduct, FullProductMetricSuite, handlePartialReceipt } from "./actions";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { LogOut, Lock } from "lucide-react";
import { 
  Sun, Moon, Search, CheckCircle2, Box, LayoutDashboard, Database,
  Warehouse, ShoppingCart, Filter, ExternalLink,
  Copy, Check, ChevronLeft, ChevronRight, Calendar, Download, AlertTriangle, TrendingUp, Link2
} from "lucide-react";
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 1. Update the interface to allow string types alongside numbers
interface EditableCellProps {
  value: number | string | undefined | null; 
  onSave: (val: string) => void;
  isDarkMode: boolean;
  inputMode?: "decimal" | "numeric";
  className?: string;
}

// Initialize the Supabase Client for Frontend Auth tracking
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onSave,
  isDarkMode,
  inputMode = "decimal",
  className = ""
}) => {
  // 2. Updated fallback check to also look for empty strings ("")
  const [localValue, setLocalValue] = React.useState<string>(
    value === 0 || value === "" || value === null || value === undefined ? "" : String(value)
  );

  React.useEffect(() => {
    setLocalValue(value === 0 || value === "" || value === null || value === undefined ? "" : String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={localValue}
      onChange={(e) => {
        const val = e.target.value;
        if (inputMode === "decimal" && val !== "" && !/^-?\d*\.?\d*$/.test(val)) return;
        if (inputMode === "numeric" && val !== "" && !/^\d*$/.test(val)) return;
        setLocalValue(val);
      }}
      onBlur={() => onSave(localValue)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`w-14 px-1.5 py-0.5 border rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
        isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
      } ${className}`}
    />
  );
};

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeWindow, setActiveWindow] = useState<1 | 2 | 3>(1);
  const [overviewProducts, setOverviewProducts] = useState<FullProductMetricSuite[]>([]);
const [pipelineProducts, setPipelineProducts] = useState<FullProductMetricSuite[]>([]);

// =====================================================================
  // 🚀 PASTE THE STEP 3 CODE RIGHT HERE (BELOW YOUR EXISTING STATES):
  // =====================================================================
  const [reconciliationReport, setReconciliationReport] = useState<any[]>([]);

  const processUploadedRows = (rows: { identifier: string; qty: number; price: number }[], poNum: string) => {
    const verifiedResults = rows.map(row => {
      const cleanIdStr = row.identifier.trim();

      const match = pipelineProducts.find(p => 
        p.purchaseOrderNumber?.trim().toLowerCase() === poNum.trim().toLowerCase() &&
        (p.upc?.trim() === cleanIdStr || p.sourceCode?.trim() === cleanIdStr)
      );

      if (!match) {
        return {
          status: "NOT_FOUND",
          identifier: cleanIdStr,
          actualQty: row.qty,
          actualPrice: row.price,
          systemProduct: null
        };
      }

      const isPriceMismatch = Number(match.orderedPrice || 0) !== Number(row.price);
      const isQtyMismatch = Number(match.orderQty || 0) !== Number(row.qty);

      return {
        status: isPriceMismatch ? "PRICE_MISMATCH" : (isQtyMismatch ? "QTY_MISMATCH" : "MATCH"),
        identifier: cleanIdStr,
        expectedQty: match.orderQty,
        actualQty: row.qty,
        expectedPrice: match.orderedPrice,
        actualPrice: row.price,
        systemProduct: match
      };
    });

    setReconciliationReport(verifiedResults);
  };

  const handleApplyProformaToInvoices = async () => {
    let count = 0;
    for (const item of reconciliationReport) {
      if (item.systemProduct) {
        count++;
        setPipelineProducts(prev => prev.map(p => p.id === item.systemProduct.id ? { ...p, invoiceQty: item.actualQty, invoicePrice: item.actualPrice } : p));
        await updateProductOperations(item.systemProduct.id, {
          invoiceQty: item.actualQty,
          invoicePrice: item.actualPrice
        }, user.email
      );
      }
    }
    alert(`Successfully processed and committed actual invoice metrics across ${count} products.`);
    setReconciliationReport([]);
  };
  // =====================================================================
  // 🔼 END OF STEP 3 CODE
  // =====================================================================

  // =====================================================================
  // 🔐 SUPABASE AUTH ENGINE HOOKS
  // =====================================================================
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // 1. Check current login active session status on boot
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // 2. Listen for real-time sign-in or sign-out updates
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
  };
  // =====================================================================

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
  const [filterPipelineDate, setFilterPipelineDate] = useState("");

  // 🌟 NEW: State engines to control the partial receipt / backorder modal window
  const [isBackorderOpen, setIsBackorderOpen] = useState(false);
  const [selectedBackorderProduct, setSelectedBackorderProduct] = useState<FullProductMetricSuite | null>(null);
  const [qtyReceivedInput, setQtyReceivedInput] = useState<number>(0);
  const [isProcessingBackorder, setIsProcessingBackorder] = useState(false);

  // Input fields form states
  const [inputOrderQty, setInputOrderQty] = useState<number>(0);
  const [orderedPrice, setOrderedPrice] = useState<number | string>(0);
  const [targetQty, setTargetQty] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<any>("RFQ");
  const [sourceUrl, setSourceUrl] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(""); 
  const [dateOrderedStr, setDateOrderedStr] = useState("");

  // --- BULK BATCH ASSIGNMENT STATES ---
const [bulkSupplierRef, setBulkSupplierRef] = useState("");
const [bulkPO, setBulkPO] = useState("");
const [bulkInvoice, setBulkInvoice] = useState("");
const [bulkOdoo, setBulkOdoo] = useState("");

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
        setLoading(true);
        const res = await getDashboardData();
        
        // Update your two separate states cleanly
        setOverviewProducts(res.overviewProducts || []);
        setPipelineProducts(res.pipelineProducts || []);
        
        if (res.overviewProducts && res.overviewProducts.length > 0) {
          loadProductToForm(res.overviewProducts[0]);
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
    setOrderedPrice(p.orderedPrice ? String(p.orderedPrice) : (p.shopPrice ? String(p.shopPrice) : "0"));
    setTargetQty(p.targetQty || 0);
    setTargetPrice((p.targetPrice !== undefined && p.targetPrice !== null && p.targetPrice !== 0) ? p.targetPrice : "");
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
    
    const todayIso = getTodayIsoString(); // Generates YYYY-MM-DD
    const displayFormattedDateStr = formatIsoStringToDisplay(todayIso); // Converts to DD/MM/YYYY

    // 1. Build the payload for the Database entry
    const updatedProductData = {
      ...selectedProduct, 
      orderQty: inputOrderQty, 
      orderedPrice: orderedPrice === "" ? 0 : Number(orderedPrice),
      targetQty,
      targetPrice: targetPrice === "" ? 0 : targetPrice,
      comment, 
      status, 
      supplier: selectedProduct?.supplier || "Unknown", 
      supplierReference,
      purchaseOrderNumber,
      dateOrderedStr: displayFormattedDateStr 
    };

    // 2. Clear Modal UI states immediately
    setCustomModalConfig(prev => ({ ...prev, isOpen: false }));
    setLocallyCommittedIds(prev => new Set(prev).add(selectedProduct.id));
    setDateOrderedStr(todayIso);

    // 3. Handle Database and Window State Processing
    startTransition(async () => {
      // ALWAYS treat an Overview Save as a NEW insertion if it comes from the sheet or if we want a fresh order row
      // This stops it from overwriting previous orders of the same ASIN!
      const result = await createProduct(updatedProductData);
      
      if (result.success && result.id) {
        // Construct the finalized clean object with its brand new unique DB UUID
        const finalizedWithRealId = { 
          ...updatedProductData, 
          id: result.id, 
          dbId: result.id 
        };
        
        // PUSH as a completely unique new record to the Pipeline Table (Window 2)
        setPipelineProducts(prev => [finalizedWithRealId, ...prev]);
        
        // UPDATE Window 1 Overview list cleanly WITHOUT creating duplicates
        setOverviewProducts(prev => {
          return prev.map((p) => {
            // Match by the original catalog ID or matching ASIN template to keep UI state aligned
            if (p.id === selectedProduct.id) {
              return { ...updatedProductData, id: selectedProduct.id }; // Retain original sidebar ID tracking token
            }
            return p;
          });
        });

        setSelectedProduct(updatedProductData as FullProductMetricSuite);
      } else {
        alert("Error initializing product row insertion layout inside Supabase Engine.");
      }
    });
  };

  const handleInlineStatusChange = (productId: string, nextStatus: any) => {
    setCustomModalConfig({
      isOpen: true,
      title: "Update Status Tracking?",
      description: `Confirm changing tracking phase parameter to ${nextStatus}?`,
      onConfirm: async () => {
        let additionalUpdates: any = { status: nextStatus };

        // Optimistically update states for both windows instantly based on distinct instances
        setOverviewProducts(prev => prev.map((p) => p.id === productId ? { ...p, status: nextStatus } : p));
        setPipelineProducts(prev => prev.map((p) => p.id === productId ? { ...p, status: nextStatus } : p));

        startTransition(async () => {
          if (productId.startsWith("catalog-")) {
            const targetProd = overviewProducts.find(p => p.id === productId);
            if (targetProd) {
              const result = await createProduct({ ...targetProd, status: nextStatus });
              if (result.success && result.id) {
                const finalItem = { ...targetProd, id: result.id, dbId: result.id, status: nextStatus };
                setPipelineProducts(prev => [finalItem, ...prev.filter(p => p.id !== productId)]);
              }
            }
          } else {
            await updateProductOperations(productId, additionalUpdates);
          }
        });

        setCustomModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };
    
  // Submit partial delivery split to Google Sheets
  const handleConfirmBackorderSplit = async () => {
    if (!selectedBackorderProduct) return;
    
    const orderedQty = Number(selectedBackorderProduct.orderedQty || 0);
    if (qtyReceivedInput <= 0 || qtyReceivedInput >= orderedQty) {
      alert(`Please enter a valid quantity between 1 and ${orderedQty - 1}.`);
      return;
    }

    setIsProcessingBackorder(true);
    try {
      const result = await handlePartialReceipt(selectedBackorderProduct.asin, qtyReceivedInput);
      
      if (result.success) {
        alert(`Successfully logged receipt! ${result.backorderQty} items have been split into a new backorder tracker row.`);
        setIsBackorderOpen(false);
        setSelectedBackorderProduct(null);
      } else {
        alert(`Error processing split: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("A critical interface connection error occurred.");
    } finally {
      setIsProcessingBackorder(false);
    }
  };

  const handleInlineNumberBlur = async (productId: string, key: 'orderQty' | 'orderedPrice' | 'targetQty' | 'targetPrice' | 'invoiceQty' | 'invoicePrice', numericVal: number) => {
    // ✅ FIX: Immediately update the local UI tables so the value doesn't vanish
    setPipelineProducts(prev => prev.map(p => p.id === productId ? { ...p, [key]: numericVal } : p));
    setOverviewProducts(prev => prev.map(p => p.id === productId ? { ...p, [key]: numericVal } : p));
    await updateProductOperations(productId, { [key]: numericVal });
  };

  const handleLiveQtyChange = (id: string, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, "");
    
    setOverviewProducts(prev => prev.map(p => p.id === id ? { ...p, orderQty: cleanVal === "" ? 0 : Number(cleanVal) } : p));
    setPipelineProducts(prev => prev.map(p => p.id === id ? { ...p, orderQty: cleanVal === "" ? 0 : Number(cleanVal) } : p));
  };
  
  // FIX: Single, clean definition updating both product lists
  const handleLivePriceChange = (id: string, value: string) => {
    let cleanVal = value.replace(/[^0-9.]/g, "");
    const parts = cleanVal.split(".");
    if (parts.length > 2) {
      cleanVal = parts[0] + "." + parts.slice(1).join("");
    }
  
    setOverviewProducts(prev => prev.map(p => p.id === id ? { ...p, orderedPrice: cleanVal === "" ? 0 : Number(cleanVal) } : p));
    setPipelineProducts(prev => prev.map(p => p.id === id ? { ...p, orderedPrice: cleanVal === "" ? 0 : Number(cleanVal) } : p));
  };
  
  const handleInlineStringBlur = async (productId: string, key: 'supplierReference' | 'comment' | 'purchaseOrderNumber' | 'dateOrderedStr' | 'invoiceNumber', valueStr: string) => {
    let finalValue = valueStr;
    if (key === 'dateOrderedStr') {
      finalValue = formatIsoStringToDisplay(valueStr);
    }
    await updateProductOperations(productId, { [key]: finalValue });
  };

  const handleExecuteBulkAssignment = async () => {
    if (selectedProductRowIds.size === 0) return;
  
    const selectedIdsArray = Array.from(selectedProductRowIds);
  
    const updateRowInline = (p: FullProductMetricSuite) => {
      if (selectedProductRowIds.has(p.id)) {
        return {
          ...p,
          supplierReference: bulkSupplierRef !== "" ? bulkSupplierRef : p.supplierReference,
          purchaseOrderNumber: bulkPO !== "" ? bulkPO : (p as any).purchaseOrderNumber,
          invoiceNumber: bulkInvoice !== "" ? bulkInvoice : (p as any).invoiceNumber,
          odooReference: bulkOdoo !== "" ? bulkOdoo : (p as any).odooReference
        };
      }
      return p;
    };



    setOverviewProducts(prev => prev.map(updateRowInline));
    setPipelineProducts(prev => prev.map(updateRowInline));
  
    for (const id of selectedIdsArray) {
      startTransition(async () => {
        if (bulkSupplierRef !== "") {
          await updateProductOperations(id, { supplierReference: bulkSupplierRef });
        }
        if (bulkPO !== "") {
          await updateProductOperations(id, { purchaseOrderNumber: bulkPO });
        }
        if (bulkInvoice !== "") {
          await updateProductOperations(id, { invoiceNumber: bulkInvoice });
        }
        if (bulkOdoo !== "") { 
          await updateProductOperations(id, { odooReference: bulkOdoo }); 
        }
      });
    }
  
    setBulkSupplierRef("");
    setBulkPO("");
    setBulkInvoice("");
    setBulkOdoo("");
    setSelectedProductRowIds(new Set()); 
    alert(`Successfully processed batch updates across ${selectedIdsArray.length} items!`);
  };

// =========================================================
  // THE NEW FUNCTIONS LIVE STANDALONE HERE (OUTSIDE THE BULK CODE)
  // =========================================================

  // 1. Live State Updater for all text and date fields in the table
  const handleLiveRowChange = (id: string, key: string, value: any) => {
    setOverviewProducts(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
    setPipelineProducts(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
  };

  // 2. Explicit Save Button Handler for the Pipeline Table
  const handleSaveRow = (p: FullProductMetricSuite) => {
    startTransition(async () => {
      const result = await updateProductOperations(p.id, {
        supplierReference: p.supplierReference,
        purchaseOrderNumber: (p as any).purchaseOrderNumber,
        invoiceNumber: (p as any).invoiceNumber,
        dateOrderedStr: p.dateOrderedStr,
        orderQty: p.orderQty,
        orderedPrice: p.orderedPrice,
        targetQty: p.targetQty,
        targetPrice: p.targetPrice,
        invoiceQty: p.invoiceQty,
        invoicePrice: p.invoicePrice,
        odooReference: (p as any).odooReference,
        status: p.status,
        comment: p.comment
      },
    user?.email || "unknown@system.com"
    );
      
      if (result.success) {
        alert(`✅ Save confirmed for ASIN: ${p.asin}`);
      } else {
        alert(`❌ Failed to save data for ASIN: ${p.asin}`);
      }
    });
  };

  const toggleSelectRow = (rowId: string) => {
    const next = new Set(selectedProductRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    setSelectedProductRowIds(next);
  };

  // --- FILTERS CONVERTED TO SPLIT ENGINE STATE ---
  const baseFilteredProducts = useMemo(() => {
    return overviewProducts.filter((p) => {
      const matchesSearch = p.asin.toLowerCase().includes(searchAsin.toLowerCase()) || p.name.toLowerCase().includes(searchAsin.toLowerCase());
      const matchDate = !selectedCalendarDate || selectedCalendarDate === "" || parseSheetDateToIso(p.sourcingDateStr) === selectedCalendarDate;
      return matchesSearch && matchDate;
    });
  }, [overviewProducts, searchAsin, selectedCalendarDate]);

  const dynamicRelevantBrands = useMemo(() => {
    const subset = baseFilteredProducts.map(p => p.brand).filter(Boolean);
    return Array.from(new Set(subset)).filter(b => b.toLowerCase().includes(brandSearchInput.toLowerCase()));
  }, [baseFilteredProducts, brandSearchInput]);

  const dynamicRelevantSuppliers = useMemo(() => {
    const subset = baseFilteredProducts
      .map(p => p.sourceUrl) // Fixed: Keep unified with supplier field tracking
      .filter(Boolean);
  
    const uniqueSuppliers = Array.from(new Set(subset));
  
    return uniqueSuppliers
      .filter(s => s.toLowerCase().includes(supplierSearchInput.toLowerCase()))
      .sort();
  }, [baseFilteredProducts, supplierSearchInput]);

  const uniqueBrandsAll = useMemo(() => Array.from(new Set(overviewProducts.map(p => p.brand).filter(Boolean))), [overviewProducts]);
  
  // Fixed: Map to p.supplier to keep it structurally unified with dropdown selection rules
  const uniqueSuppliersAll = useMemo(() => Array.from(new Set(overviewProducts.map(p => p.supplier).filter(Boolean))), [overviewProducts]);

  const pipelineSuppliers = useMemo(() => {
    const subset = pipelineProducts.map(p => p.sourceUrl).filter(Boolean); // Fixed: Map to p.supplier
    return Array.from(new Set(subset)).sort();
  }, [pipelineProducts]);

  const pipelineBrands = useMemo(() => {
    const subset = pipelineProducts.map(p => p.brand).filter(Boolean);
    return Array.from(new Set(subset)).sort();
  }, [pipelineProducts]);

  const finalFilteredOverviewProducts = useMemo(() => {
    return baseFilteredProducts.filter((p) => {
      const brandMatch = !selectedBrand || (p.brand && p.brand.toLowerCase() === selectedBrand.toLowerCase());
      
      // Fixed: Change p.sourceUrl to p.supplier to precisely match selectedOverviewSupplier state tracking value
      const supplierMatch = !selectedOverviewSupplier || (p.supplier && p.supplier.toLowerCase() === selectedOverviewSupplier.toLowerCase());
      
      return brandMatch && supplierMatch;
    });
  }, [baseFilteredProducts, selectedBrand, selectedOverviewSupplier]);

  const pipelineFilteredProducts = useMemo(() => {
    return pipelineProducts.filter((p) => {
      const matchSupplier = filterSupplier === "ALL" || p.sourceUrl === filterSupplier;
      const matchBrand = filterBrand === "ALL" || p.brand === filterBrand;
      const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
      const matchDate = !pipelineFilterDate || parseSheetDateToIso(p.sourcingDateStr) === pipelineFilterDate;
      
      const matchPipelineDate = filterPipelineDate === "" || parseSheetDateToIso(p.dateOrderedStr) === filterPipelineDate;
      
      let matchQuery = true;
      if (pipelineSearch.trim()) {
        const q = pipelineSearch.toLowerCase().trim();
        matchQuery = p.asin.toLowerCase().includes(q) || 
                     p.upc.toLowerCase().includes(q) || 
                     (p.supplierReference && p.supplierReference.toLowerCase().includes(q)) || 
                     ((p as any).purchaseOrderNumber && (p as any).purchaseOrderNumber.toLowerCase().includes(q));
      }

      return matchSupplier && matchBrand && matchStatus && matchDate && matchPipelineDate && matchQuery;
    });
  }, [pipelineProducts, filterSupplier, filterBrand, filterStatus, pipelineFilterDate, filterPipelineDate, pipelineSearch]);
  
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

  // =====================================================================
  // FUNCTION 1: EXPORT MAIL FORMAT (.XLSX) - FIXED & ACCURATE
  // =====================================================================
  const triggerExcelSpreadsheetDownload = () => {
    if (!pipelineFilteredProducts || pipelineFilteredProducts.length === 0) {
      alert("No data available in the current table layout to export.");
      return;
    }

    // 1. Construct the data objects using your specific required headers
    const spreadsheetData = pipelineFilteredProducts.map((p, index) => {
      // Clean and format raw string parameters to force strict 13-digit UPC representation
      const rawUpc = (p.upc || "").replace(/[^0-9]/g, "");
      const formattedUpc = rawUpc ? rawUpc.padStart(13, "0").slice(-13) : "";

      return {
        "Sl No": index + 1,
        "Product Name": p.name || "-",
        "UPC": formattedUpc || "-",
        "Source Code": p.sourceCode || "N/A",
        "Target Qty": p.targetQty || 0,
        "Your Price": p.livePrice ? Number(p.livePrice) : 0, // 🌟 FIXED: Maps live shop price here instead of ordered price
        "Target Price": p.targetPrice ? Number(p.targetPrice) : 0,
        "Offer Price": "" 
      };
    });

    // 2. Compile data objects directly into a real Excel worksheet binary matrix
    const worksheet = XLSX.utils.json_to_sheet(spreadsheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mail Format Report");

    // 3. 🌟 ENFORCE UPC STRING PARSING (Prevents Excel rounding or deleting leading zeros)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:H1');
    for (let r = range.s.r + 1; r <= range.e.r; ++r) {
      const upcCellAddress = XLSX.utils.encode_cell({ r, c: 2 }); // Column Index 2 is the 'UPC' Column
      if (worksheet[upcCellAddress]) {
        worksheet[upcCellAddress].t = 's'; // Set cell metadata token type to 'String'
        worksheet[upcCellAddress].z = '@'; // Force Excel formatting layout mask to explicit Text
      }
    }

    // 4. 🌟 DYNAMIC AUTO-FIT COLUMN WIDTH CALCULATOR
    const columnKeys = Object.keys(spreadsheetData[0]);
    const autoFitCols = columnKeys.map(key => {
      let maxCharLength = key.length; // Default to column header title text size
      
      spreadsheetData.forEach(row => {
        const cellValue = row[key as keyof typeof row];
        if (cellValue !== null && cellValue !== undefined) {
          const valueLength = String(cellValue).length;
          if (valueLength > maxCharLength) {
            maxCharLength = valueLength;
          }
        }
      });
      
      // Pad out the width slightly (+3) so nothing is clipped visually
      return { wch: Math.max(maxCharLength + 3, 10) };
    });
    worksheet["!cols"] = autoFitCols;

    // 5. Download output utilizing valid OpenXML (.xlsx) streams to clear file extension warnings
    const todayTimestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Mail_Format_${todayTimestamp}.xlsx`);
  };

  const formatVal = (val: any, isCurrency = false) => {
    if (val === undefined || val === null || val === "" || val === 0 || val === "0" || val === "N/A" || val === "—") return "-";
    if (isCurrency && typeof val === "number") return `£${val.toFixed(2)}`;
    return val;
  };

// =====================================================================
  // DYNAMIC GRID TABLE EXCEL DOWNLOAD ENGINE
  // =====================================================================
  const downloadPipelineTableToExcel = () => {
    if (!pipelineFilteredProducts || pipelineFilteredProducts.length === 0) {
      alert("No data available in the current table layout to export.");
      return;
    }

    // 1. Map all 18 table headers exactly to column records
    const spreadsheetData = pipelineFilteredProducts.map((p, index) => {
      // Force clean 13-digit string format for the UPC attribute
      let upcStr = p.upc ? String(p.upc).trim() : "";
      if (upcStr && upcStr.length < 13 && /^\d+$/.test(upcStr)) {
        upcStr = upcStr.padStart(13, "0"); // Restores leading zeros if truncated
      }

      return {
        "Row #": index + 1,
        "ASIN": p.asin || "-",
        "UPC": upcStr || "-",
        "Source Code": p.sourceCode || "-",
        "Product Name Title": p.name || "-",
        "Supplier": p.sourceUrl || "-",
        "Supplier Reference": p.supplierReference || "-",
        "Purchase Order (PO)": (p as any).purchaseOrderNumber || "-",
        "Invoice Number": (p as any).invoiceNumber || "-", 
        "Date Ordered": p.dateOrderedStr || "-",
        "Target Qty": p.targetQty !== "" ? Number(p.targetQty) : 0,
        "Target Price": p.targetPrice ? Number(p.targetPrice) : 0,
        "Ordered Qty": p.orderQty ? Number(p.orderQty) : 0,
        "Ordered Price": p.orderedPrice ? Number(p.orderedPrice) : 0,
        
        "Total Price": p.orderQty && p.orderedPrice ? Number((p.orderQty * p.orderedPrice).toFixed(2)) : 0,
        "Invoice Qty": p.invoiceQty ? Number(p.invoiceQty) : 0,
        "Invoice Price": p.invoicePrice ? Number(p.invoicePrice) : 0,
        "Odoo Reference": (p as any).odooReference || "-",
        "Net Profit": (p as any).netProfit ? Number((p as any).netProfit) : 0,
        "Pipeline Status": p.status || "-",
        "Internal Log Commentary": p.comment || ""
      };
    });

    // 2. Generate standard Excel Sheet Workbook Structures
    const worksheet = XLSX.utils.json_to_sheet(spreadsheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pipeline Report");

    // 3. Explicitly format the UPC Column (Column C, index 2) as text
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:S1');
    for (let r = range.s.r + 1; r <= range.e.r; ++r) {
      const cellAddress = XLSX.utils.encode_cell({ r, c: 2 }); 
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].t = 's'; // Force Cell type to String
        worksheet[cellAddress].z = '@'; // Force text format template mask
      }
    }

    // 4. DYNAMIC AUTO-FIT COLUMN WIDTH ENGINE
    const columnKeys = Object.keys(spreadsheetData[0]);
    const autoFitCols = columnKeys.map(key => {
      let maxCharLength = key.length;
      spreadsheetData.forEach(row => {
        const cellValue = row[key as keyof typeof row];
        if (cellValue !== null && cellValue !== undefined) {
          const valueLength = String(cellValue).length;
          if (valueLength > maxCharLength) {
            maxCharLength = valueLength;
          }
        }
      });
      return { wch: Math.max(maxCharLength + 3, 10) };
    });

    worksheet["!cols"] = autoFitCols;

    // 5. Download output report file stream binary
    const todayTimestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Supplier_Pipeline_Master_${todayTimestamp}.xlsx`);
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

// =====================================================================
// 🔐 PASTE THE STEP 3 LOGIN GATE HERE (RIGHT BEFORE THE MAIN RETURN):
// =====================================================================
if (authLoading) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
      Verifying secure access token layers...
    </div>
  );
}

if (!user) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 mb-3 border border-indigo-500/20">
            <Lock size={20} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-wider text-white">Internal Operations Portal</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Authorized corporate access credentials required</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500">Corporate Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full border border-slate-800 rounded-lg px-3 py-2.5 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500">Secure Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-slate-800 rounded-lg px-3 py-2.5 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold leading-relaxed">
              ⚠️ {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider transition-colors shadow-lg shadow-indigo-600/15"
          >
            Authenticate & Decrypt
          </button>
        </form>
      </div>
    </div>
  );
}
// =====================================================================

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-sans text-xs antialiased select-none transition-colors duration-150 ${
      isDarkMode ? "bg-[#060814] text-[#94a3b8]" : "bg-[#f1f5f9] text-slate-900"
    }`}>
      
      {/* DIRECT APPLICATION-LEVEL MODAL */}
      {customModalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fadeIn">
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
            {/* 🚀 3. ADDED: Proforma Verifier */}
  <button 
    type="button" 
    onClick={() => setActiveWindow(3)} 
    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-bold transition-all ${isSidebarCollapsed ? "justify-center" : "gap-3"} ${activeWindow === 3 ? (isDarkMode ? "bg-[#1e293b] text-white" : "bg-blue-50 text-blue-950 border border-blue-200") : "opacity-75 hover:opacity-100"}`}
  >
    <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
    {!isSidebarCollapsed && <span>Proforma Verifier</span>}
  </button>
          </div>
        </div>

{/* 🚀 ADDED: SECURE LOGOUT BUTTON AT THE BOTTOM OF THE SIDEBAR */}
<div className="mt-auto p-3 border-t border-slate-400/10">
    <button
      type="button"
      onClick={handleLogout}
      className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left font-bold transition-all text-rose-500 hover:bg-rose-500/10 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}
    >
      <LogOut size={16} className="shrink-0" />
      {!isSidebarCollapsed && <span className="text-xs uppercase tracking-wider font-black">Secure Sign Out</span>}
    </button>
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
  {/* Filter down the rendered array so it only shows each ASIN exactly once in the sidebar list */}
  {(() => {
    const seenAsins = new Set<string>();
    const uniqueFilteredList = finalFilteredOverviewProducts.filter((p) => {
      if (!p.asin) return false;
      const upperAsin = p.asin.toUpperCase();
      if (seenAsins.has(upperAsin)) return false;
      seenAsins.add(upperAsin);
      return true;
    });

    return uniqueFilteredList.map((p) => (
      <button 
        type="button" 
        key={p.id} 
        onClick={() => loadProductToForm(p)} 
        className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col ${selectedProductId === p.id ? "bg-indigo-600/10 border-indigo-600 shadow-sm" : `${isDarkMode ? "bg-[#060814]/60 border-[#1e293b]/70 hover:bg-[#060814]" : "bg-slate-50 border-slate-200 hover:bg-white"}`}`}
      >
        <div className="flex justify-between items-center w-full font-mono">
          <span className={`font-black text-xs ${selectedProductId === p.id ? "text-indigo-600" : (isDarkMode ? "text-white" : "text-slate-950")}`}>{p.asin}</span>
          <span className="text-[9px] font-bold text-slate-500">{p.sourcingDateStr}</span>
        </div>
        <span className={`text-xs font-semibold mt-1 whitespace-normal break-words leading-tight ${themeTextSubtitle}`}>{p.name}</span>
      </button>
    ));
  })()}

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
                      <span className={`text-[10px] font-black uppercase block border-b border-slate-400/30 pb-1.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-950"}`}>IDENTIFIERS</span>
                      
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
                        {prodData.name || "No Product Selected"}
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

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 My-2 font-mono">
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Live Avail Qty</span>
                          <span className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-950"}`}>{formatVal(prodData.liveAvailableQty)}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Live Shop Price</span>
                          <span className="font-black text-sm text-indigo-600">{prodData.livePrice ? Number(prodData.livePrice).toFixed(2) : "0.00"}</span>
                        </div>
                        <div className={`p-2 rounded border text-center ${isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200 shadow-xs"}`}>
                          <span className="text-slate-500 text-[8px] block uppercase font-bold">Shop Price</span>
                          <span className={`font-black text-sm ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>{prodData.shopPrice ? Number(prodData.shopPrice).toFixed(2) : "0.00"}</span>
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
                          <span className="text-slate-500 font-bold uppercase text-[9px]">Profit:</span>
                          <span className="font-black text-sm text-emerald-600">{formatVal(prodData.profit, true)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold uppercase text-[9px]">ROI Percentage:</span>
                          <span className="font-black text-sm text-indigo-600">{prodData.roiPercentage ? `${prodData.roiPercentage.toFixed(1)}%` : "-"}</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1">
                          <span className="text-slate-500 text-[9px] uppercase font-bold">Market Price:</span>
                          <span className={`font-mono font-black ${isDarkMode ? "text-slate-300" : "text-slate-900"}`}>{prodData.googlePrice || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* BUY SHEET BSR PERFORMANCE MATRIX TILE */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[175px] ${themeCardBg}`}>
                      <div className="border-b border-slate-400/30 pb-1.5 flex items-center gap-1 text-indigo-500">
                        <TrendingUp size={12} />
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? "text-indigo-400" : "text-indigo-950"}`}>
                          AVERAGE BSR
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
                        <span>60 Days Suppliers:</span>
                        <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-950"}`}>{prodData.distinctsuppliercount || "N/A"}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium pt-1.5 border-t border-dashed border-slate-400/30 flex justify-between">
                        <span>BQOOL GROUP:</span>
                        <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-950"}`}>{prodData.bqoolGroup || "N/A"}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium pt-1.5 border-t border-dashed border-slate-400/30 flex justify-between">
                        <span>Introduced By:</span>
                        <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-950"}`}>{prodData.introducedBy || "N/A"}</span>
                      </div>
                    </div>

                  </div>

                  {/* ======================================================================= */}
{/* 📊 ZOHO PERFORMANCE SALES VELOCITY DATA PANEL                           */}
{/* ======================================================================= */}
<div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 h-auto ${themeCardBg}`}>
  <div className="border-b border-slate-400/20 pb-1 flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
      <TrendingUp size={12} /> Sales &amp; Profit
    </span>
    <span className="text-[9px] font-bold text-slate-500 font-mono">ASIN Lookup Sync Active</span>
  </div>

  {/* 📝 COMPACTED SOURCING & REVIEW NOTES BLOCK */}
  {selectedProduct && (
    <div className={`p-2 rounded-lg border flex flex-col gap-1.5 ${
      isDarkMode ? 'border-slate-800/80 bg-slate-900/10' : 'border-slate-200 bg-slate-50/50'
    }`}>
      
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Notes by Sourcer Box */}
        <div className="flex flex-col gap-0.5">
          <span className={`font-bold uppercase text-[8px] tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Notes By Sourcer
          </span>
          <div className={`p-1.5 rounded-md text-[11px] font-mono break-words border leading-normal ${
            isDarkMode ? 'bg-slate-950/60 border-slate-800/80 text-slate-200' : 'bg-white border-slate-200/60 text-slate-800'
          }`}>
            {selectedProduct.notesBySourcer || <span className="italic opacity-40 text-[10px]">No records filed</span>}
          </div>
        </div>

        {/* Notes by Reviewer Box */}
        <div className="flex flex-col gap-0.5">
          <span className={`font-bold uppercase text-[8px] tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Notes By Reviewer
          </span>
          <div className={`p-1.5 rounded-md text-[11px] font-mono break-words border leading-relaxed ${
            isDarkMode ? 'bg-slate-950/60 border-slate-800/80 text-slate-200' : 'bg-white border-slate-200/60 text-slate-800'
          }`}>
            {selectedProduct.notesByReviewer || <span className="italic opacity-40 text-[10px]">No records filed</span>}
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Compact 5-Column Grid Matrix */}
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 font-mono py-0.5">
    {[
      { label: '3D Units', val: prodData.zohoUnits3d, pLabel: '3D Profit', pVal: prodData.zohoProfit3d, highlight: false },
      { label: '7D Units', val: prodData.zohoUnits7d, pLabel: '7D Profit', pVal: prodData.zohoProfit7d, highlight: false },
      { label: '30D Units', val: prodData.zohoUnits30d, pLabel: '30D Profit', pVal: prodData.zohoProfit30d, highlight: 'indigo' },
      { label: '90D Units', val: prodData.zohoUnits90d, pLabel: '90D Profit', pVal: prodData.zohoProfit90d, highlight: false },
      { label: '2026 YTD Units', val: prodData.zohoUnits2026, pLabel: 'YTD Profit', pVal: prodData.zohoProfit2026, highlight: 'amber' }
    ].map((tile, i) => {
      const isIndigo = tile.highlight === 'indigo';
      const isAmber = tile.highlight === 'amber';
      
      let bgStyle = isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200";
      if (isIndigo) bgStyle = isDarkMode ? "bg-indigo-950/30 border-indigo-500/30" : "bg-indigo-50/50 border-indigo-200";
      if (isAmber) bgStyle = isDarkMode ? "bg-amber-950/30 border-amber-500/30" : "bg-amber-50 border-amber-200";

      let textStyle = isDarkMode ? "text-white" : "text-slate-950";
      if (isIndigo) textStyle = "text-indigo-500 dark:text-indigo-400";
      if (isAmber) textStyle = "text-amber-600 dark:text-amber-500";

      return (
        <div key={i} className={`p-2 rounded-lg border flex flex-col justify-between min-h-[72px] transition-all ${bgStyle}`}>
          <span className={`${isIndigo ? 'text-indigo-500 font-black' : isAmber ? 'text-amber-500 font-black' : 'text-slate-500 font-bold'} text-[8px] block uppercase tracking-wider`}>
            {tile.label}
          </span>
          <span className={`font-black text-lg leading-none tracking-tight my-0.5 ${textStyle}`}>
            {formatVal(tile.val)}
          </span>
          <div className="border-t border-slate-500/10 pt-0.5 mt-0.5 flex justify-between items-center">
            <span className={`text-[8px] font-medium ${isIndigo ? 'text-indigo-400/70' : isAmber ? 'text-amber-400/70' : 'text-slate-400'}`}>{tile.pLabel}:</span>
            <span className="font-extrabold text-[11px] text-emerald-500">{formatVal(tile.pVal, true)}</span>
          </div>
        </div>
      );
    })}
  </div>
</div>

{/* ======================================================================= */}
{/* 📊 ZOHO HISTORICAL SOURCING TRENDS DATA PANEL                           */}
{/* ======================================================================= */}
<div className={`p-3 rounded-xl border flex flex-col justify-between gap-1 mt-1 ${themeCardBg}`}>
  <div className="border-b border-slate-400/20 pb-1 flex items-center justify-between">
    <span className="text-[10px] font-black uppercase tracking-wider text-teal-500 flex items-center gap-1.5">
      <Link2 size={12} /> Historical Sourcing &amp; Supplier Pricing Landscapes
    </span>
    <span className="text-[9px] font-bold text-slate-500 font-mono">Competitor Cost Discovery</span>
  </div>
  
  {/* TOP ROW: Core Marketplaces (3 Compact Columns) */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    {/* PHCT Box */}
    <div className={`p-2 border rounded-lg flex flex-col justify-between min-h-[62px] ${isDarkMode ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/40 border-indigo-100"}`}>
      <span className="text-[8px] font-black tracking-wider text-indigo-400 uppercase">PHCT Marketplace</span>
      <span className="text-base font-black text-slate-400 my-0.5">{formatVal(prodData.phctMinPrice, true)}</span>
      <span className="text-[9px] font-medium text-slate-400 truncate">🏭 {prodData.phctMinSupplier || "-"}</span>
    </div>

    {/* ABC Box */}
    <div className={`p-2 border rounded-lg flex flex-col justify-between min-h-[62px] ${isDarkMode ? "bg-teal-950/20 border-teal-900/50" : "bg-teal-50/40 border-teal-100"}`}>
      <span className="text-[8px] font-black tracking-wider text-teal-400 uppercase">ABC Channels</span>
      <span className="text-base font-black text-slate-400 my-0.5">{formatVal(prodData.abcMinPrice, true)}</span>
      <span className="text-[9px] font-medium text-slate-400 truncate">🏭 {prodData.abcMinSupplier || "-"}</span>
    </div>

    {/* United Kingdom Box */}
    <div className={`p-2 border rounded-lg flex flex-col justify-between min-h-[62px] ${isDarkMode ? "bg-amber-950/20 border-amber-900/50" : "bg-amber-50/40 border-amber-100"}`}>
      <span className="text-[8px] font-black tracking-wider text-amber-400 uppercase">United Kingdom Core</span>
      <span className="text-base font-black text-slate-400 my-0.5">{formatVal(prodData.ukMinPrice, true)}</span>
      <span className="text-[9px] font-medium text-slate-400 truncate">🏭 {prodData.ukMinSupplier || "-"}</span>
    </div>
  </div>

  <div className={`border-t border-dashed my-0.5 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`} />

  {/* BOTTOM ROW: Chronological Historical Rolling Intervals */}
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {[
      { label: '10 Days Rolling', price: prodData.priceMin10d, supp: prodData.supplierMin10d },
      { label: '30 Days Rolling', price: prodData.priceMin30d, supp: prodData.supplierMin30d },
      { label: '90 Days Rolling', price: prodData.priceMin90d, supp: prodData.supplierMin90d },
      { label: '330 Days Rolling', price: prodData.priceMin330d, supp: prodData.supplierMin330d }
    ].map((box, i) => (
      <div key={i} className={`p-2 border rounded-lg flex flex-col justify-between min-h-[58px] ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/50 border-slate-100"}`}>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">{box.label}</span>
        <span className="text-sm font-extrabold text-indigo-400">{formatVal(box.price, true)}</span>
        <span className="text-[9px] font-medium text-slate-400 truncate">👤 {box.supp || "-"}</span>
      </div>
    ))}
  </div>
</div>

{/* ======================================================================= */}
{/* 🛠️ BOTTOM WORKBENCH PLACEMENT CONTROL WORKFLOW FORM                     */}
{/* ======================================================================= */}
<div className="w-full mt-1">
<form onSubmit={handleOverviewFormSubmit} className={`p-3 rounded-xl border flex flex-col gap-2 w-full shadow-sm ${themeCardBg}`}>
    <div className="flex items-center gap-2 text-indigo-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-400/20 pb-1">
      <CheckCircle2 size={13} /> Order Placement
    </div>

    <div className="w-full flex flex-col gap-2">
      {/* ROW 1: Compact Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 w-full">
        {[
          { label: 'Supplier Name', type: 'text', placeholder: 'Vendor URL parameter...', val: selectedProduct?.sourceUrl || "", change: (v: string) => selectedProduct && setSelectedProduct({...selectedProduct, sourceUrl: v}), mono: false },
          { label: 'Supplier Reference Number', type: 'text', placeholder: 'Ref code...', val: supplierReference, change: setSupplierReference, mono: true },
          { label: 'PO Number', type: 'text', placeholder: 'PO tag...', val: purchaseOrderNumber, change: setPurchaseOrderNumber, mono: true },
          { label: 'Date Order', type: 'date', placeholder: '', val: getTodayIsoString(), change: setDateOrderedStr, mono: true, isDate: true }
        ].map((inp, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            <label className="text-[8px] font-black uppercase text-slate-500 block">{inp.label}</label>
            <input 
              type={inp.type} 
              placeholder={inp.placeholder} 
              value={inp.val} 
              onChange={(e) => inp.change(e.target.value)} 
              className={`w-full border rounded-md px-2 py-1.5 text-xs focus:outline-none ${themeInputBg} ${inp.mono ? 'font-mono' : ''} ${inp.isDate ? (!isDarkMode ? "scheme-light" : "scheme-dark") : ""}`} 
            />
          </div>
        ))}
      </div>

      {/* ROW 2: Compact Metrics Grid & Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 items-end border-t border-slate-400/10 pt-2 w-full">
        
        {/* Target Qty */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-black uppercase text-slate-500 block">Target Qty</label>
          <input 
            type="number" 
            value={targetQty === 0 ? "" : targetQty} 
            onChange={(e) => setTargetQty(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} 
            className={`w-full border rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [moz-appearance:textfield] ${themeInputBg}`} 
          />
        </div>

        {/* Target Price */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-black uppercase text-slate-500 block">Target Price</label>
          <input 
            type="number" 
            step="0.01" 
            value={targetPrice === "" ? "" : targetPrice} 
            onChange={(e) => {
              const val = e.target.value;
              setTargetPrice(val === "" ? "" : parseFloat(val) || 0);
            }} 
            className={`w-full border rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] ${themeInputBg}`} 
          />
        </div>

        {/* Order Qty */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-black uppercase text-slate-500 block">Order Qty</label>
          <input 
            type="number" 
            value={inputOrderQty === 0 ? "" : inputOrderQty} 
            onChange={(e) => setInputOrderQty(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} 
            className={`w-full border rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [moz-appearance:textfield] ${themeInputBg}`} 
          />
        </div>

        {/* Ordered Price */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-black uppercase text-slate-500 block">Order Price</label>
          <input 
            type="number" 
            step="0.01" 
            value={orderedPrice === 0 ? "" : orderedPrice} 
            onChange={(e) => setOrderedPrice(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)} 
            className={`w-full border rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [moz-appearance:textfield] ${themeInputBg}`} 
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-black uppercase text-slate-500 block">Status</label>
          <select 
            value={status} 
            onChange={(e) => { const next = e.target.value; setStatus(next); if (next === "ORDERED") setDateOrderedStr(getTodayIsoString()); }} 
            className={`w-full border rounded-md px-2 py-1.5 text-xs font-bold focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-indigo-400" : "bg-white border-slate-400 text-indigo-950"}`}
          >
            {["NOT REVIEWED", "NOT SELECTED", "NOT SELECTED - Stock", "NOT SELECTED - Price", "WAITING FOR MOV", "BUYING FROM ANOTHER SUPPLIER", "RFQ", "RFQ UNDER REVIEW", "PENDING TO ORDER", "ORDERED", "CONFIRMED", "COLLECTED", "INVOICED", "CANCELLED", "CLOSED"].map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Internal Notes */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-black uppercase text-slate-500 block">Internal Notes</label>
          <input type="text" placeholder="Type notes..." value={comment} onChange={(e) => setComment(e.target.value)} className={`w-full border rounded-md px-2 py-1.5 text-xs focus:outline-none ${themeInputBg}`} />
        </div>
      </div>

      {/* 🚀 ADDED: LIVE COMPUTED VALUES BAR */}
<div className={`flex flex-wrap gap-4 items-center px-2.5 py-1.5 rounded-lg border text-[10px] mt-1 w-full ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
  <div className="flex items-center gap-1.5">
    <span className="text-slate-500 font-bold uppercase tracking-wider">Target Value:</span>
    <span className={`font-mono font-black text-xs ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
      £{((targetQty || 0) * (Number(targetPrice) || 0)).toFixed(2)}
    </span>
  </div>
  
  <div className={`h-3 w-[1px] hidden sm:block ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
  
  <div className="flex items-center gap-1.5">
    <span className="text-slate-500 font-bold uppercase tracking-wider">Ordered Value:</span>
    <span className={`font-mono font-black text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
      {/* 👇 Wrapped orderedPrice in Number() to satisfy TypeScript */}
      £{((inputOrderQty || 0) * (Number(orderedPrice) || 0)).toFixed(2)}
    </span>
  </div>
</div>

      {/* ROW 3: Form Submission Trigger */}
      <div className="pt-0.5 flex justify-start">
        <button type="submit" disabled={isPending} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-all ${isPending ? "bg-slate-600" : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]"}`}>
          {isPending ? "Saving..." : "Confirm"}
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

{/* ======================================================================= */}
{/* 🌟 NEW RIGHT SIDE DOCK AREA PANEL FOR STOCK LEDGER MATRIX               */}
{/* ======================================================================= */}
<div className={`w-[280px] rounded-xl border flex flex-col min-h-0 shrink-0 p-3 gap-2 overflow-y-auto custom-scrollbar ${
  isDarkMode ? 'border-slate-800' : 'border-slate-200'
} ${themeCardBg}`}>
  
  {/* Compact Header Elements */}
  <div className={`flex items-center justify-between border-b pb-2 ${
    isDarkMode ? 'border-slate-800' : 'border-slate-200'
  }`}>
    <h2 className={`text-xs font-bold uppercase tracking-wider ${
      isDarkMode ? 'text-slate-400' : 'text-slate-600'
    }`}>
      Stock & Inventory
    </h2>
    <Database size={13} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
  </div>

  {/* Tile 1: Amazon Stock Ledger */}
  <div className={`p-2.5 rounded-lg border ${
    isDarkMode ? 'border-slate-800/60' : 'border-slate-200'
  } ${themeInputBg}`}>
    <div className="flex items-center justify-between gap-1.5 mb-2 border-b border-slate-400/10 pb-1.5">
      <div className={`flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider ${
        isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
      }`}>
        <Box size={13} />
        <span>Amazon Stock</span>
      </div>
      {selectedProduct && (
        <span className={`font-mono text-[12px] px-1.5 py-0.5 rounded border font-bold ${
          isDarkMode 
            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-900/50' 
            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          Sum: {formatVal(amazonStockSum)}
        </span>
      )}
    </div>
    
    {selectedProduct ? (
      <div className="space-y-1.5 font-mono text-[12px]">
        {[
          { label: 'TRA FBA', val: selectedProduct.traFba },
          { label: 'Reserved AMZ', val: selectedProduct.reservedAmz },
          { label: 'TO AMZ', val: selectedProduct.toAmz },
          { label: 'TRA AMZ', val: selectedProduct.traAmz },
        ].map((item, idx, arr) => (
          <div key={item.label} className={`flex justify-between pb-1 ${
            idx !== arr.length - 1 ? 'border-b border-slate-400/10' : ''
          }`}>
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>{item.label}:</span>
            <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {formatVal(item.val)}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className={`text-center italic text-[10px] py-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        No active item selected
      </div>
    )}
  </div>

  {/* Tile 2: Warehouse Stock */}
  <div className={`p-2.5 rounded-lg border ${
    isDarkMode ? 'border-slate-800/60' : 'border-slate-200'
  } ${themeInputBg}`}>
    <div className="flex items-center justify-between gap-1.5 mb-2 border-b border-slate-400/10 pb-1.5">
      <div className={`flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider ${
        isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
      }`}>
        <Warehouse size={13} />
        <span>Warehouse Stock</span>
      </div>
      {selectedProduct && (
        <span className={`font-mono text-[12px] px-1.5 py-0.5 rounded border font-bold ${
          isDarkMode 
            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900/50' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          Sum: {formatVal(whStockSum)}
        </span>
      )}
    </div>

    {selectedProduct ? (
      <div className="space-y-1.5 font-mono text-[12px]">
        {[
          { label: 'SM6 7AH', val: selectedProduct.sm67ah },
          { label: 'TRA B2B', val: selectedProduct.traB2b },
          { label: 'TRA BAY', val: selectedProduct.traBay },
          { label: 'WEB SHP', val: selectedProduct.webShp },
          { label: 'TRA FBM', val: selectedProduct.traFbm },
        ].map((item, idx, arr) => (
          <div key={item.label} className={`flex justify-between pb-1 ${
            idx !== arr.length - 1 ? 'border-b border-slate-400/10' : ''
          }`}>
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>{item.label}:</span>
            <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {formatVal(item.val)}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className={`text-center italic text-[10px] py-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        No active item selected
      </div>
    )}
  </div>

  {/* Tile 3: Operational Active Pipeline */}
  <div className={`p-2.5 rounded-lg border ${
    isDarkMode ? 'border-slate-800/60' : 'border-slate-200'
  } ${themeInputBg}`}>
    <div className="flex items-center justify-between gap-1.5 mb-2 border-b border-slate-400/10 pb-1.5">
      <div className={`flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider ${
        isDarkMode ? 'text-teal-400' : 'text-teal-600'
      }`}>
        <ShoppingCart size={13} />
        <span>Ordered Stock</span>
      </div>
      {selectedProduct && (
        <span className={`font-mono text-[12px] px-1.5 py-0.5 rounded border font-bold ${
          isDarkMode 
            ? 'bg-teal-950/60 text-teal-300 border-teal-900/50' 
            : 'bg-teal-50 text-teal-700 border-teal-200'
        }`}>
          Sum: {formatVal(orderedStockSum)}
        </span>
      )}
    </div>

    {selectedProduct ? (
      <div className="space-y-1.5 font-mono text-[12px]">
        <div className="flex justify-between border-b border-slate-400/10 pb-1">
          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>RFQ:</span>
          <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {formatVal(selectedProduct.rfqCount)}
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-400/10 pb-1">
          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>B2B Ordered:</span>
          <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {formatVal(selectedProduct.b2bOrdered)}
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-400/10 pb-1">
          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Ordered Qty:</span>
          <span className={`font-black ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {formatVal(selectedProduct.orderedQty)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>TO WHS:</span>
          <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {formatVal(selectedProduct.toWhs)}
          </span>
        </div>
      </div>
    ) : (
      <div className={`text-center italic text-[10px] py-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        No active item selected
      </div>
    )}
  </div>

  {/* Tile 4: Last Purchase Details */}
  <div className={`p-2.5 rounded-lg border ${
    isDarkMode ? 'border-slate-800/60' : 'border-slate-200'
  } ${themeInputBg}`}>
    <div className={`flex items-center gap-1.5 mb-2 border-b border-slate-400/10 pb-1.5 font-bold text-[11px] uppercase tracking-wider ${
      isDarkMode ? 'text-purple-400' : 'text-purple-600'
    }`}>
      <TrendingUp size={13} />
      <span>Last Purchase Details</span>
    </div>

    {selectedProduct ? (
      <div className="space-y-2">
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between border-b border-slate-400/10 pb-1">
            <span className={`font-bold uppercase text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Last Purchased Shop Price:</span>
            <span className={`font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {selectedProduct.lastPrice ? Number(selectedProduct.lastPrice).toFixed(2) : "-"}
            </span>
          </div>
          
          <div className="flex justify-between border-b border-slate-400/10 pb-1">
            <span className={`font-bold uppercase text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Last Purchased Supplier:</span>
            <span className={`font-black max-w-[140px] truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {selectedProduct.lastPurchasedSupplier || "N/A"}
            </span>
          </div>
          
          <div className={`flex justify-between text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>Last Purchased Date:</span>
            <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedProduct.lastPurchasedDate || "—"}</span>
          </div>

          <div className={`flex justify-between text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>RFQ Details:</span>
            <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedProduct.rfqDetails || "—"}</span>
          </div>
        </div>

        {/* Complete Aggregated Total Stock Summary Pill */}
        <div className={`rounded-lg border p-1.5 flex items-center justify-between text-[11px] font-mono mt-1 ${
          isDarkMode ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-200'
        }`}>
          <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Last Purchased Qty:</span>
          <span className={`font-black text-xs ${isDarkMode ? 'text-amber-500' : 'text-amber-700'}`}>
            {formatVal(selectedProduct.lastPurchasedQty)} pcs
          </span>
        </div>
        
          <div className={`flex justify-between text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>MA COGS:</span>
            <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedProduct.macogs || "—"}</span>
          </div>
          <div className={`flex justify-between text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>TRAIL COGS:</span>
            <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedProduct.trailcogs || "—"}</span>
          </div>
          <div className={`flex justify-between text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>Estimated Sales:</span>
            <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedProduct.estimatedsales || "—"}</span>
          </div>
      </div>
      
    ) : (
      <div className={`text-center italic text-[10px] py-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        No active item selected
      </div>
    )}
  </div>
</div>

          </div>




        )}

        {/* WINDOW 2 MODULE (SUPPLIER PIPELINE DATA TABLE GRID LEDGER) */}
        {activeWindow === 2 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 p-4 overflow-y-auto custom-scrollbar">
            
            <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 ${themeCardBg}`}>
              <div className="flex items-center gap-2 text-indigo-500 font-black uppercase text-[10px] tracking-wider shrink-0"><Filter size={14} /> Filters:</div>
              
              <div className="w-full lg:w-44">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Search</label>
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
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Brand</label>
                <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL BRANDS</option>
                  {/* 🌟 FIX: Change uniqueBrandsAll to pipelineBrands */}
                  {pipelineBrands.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="w-full lg:w-40">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Supplier</label>
                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL SUPPLIERS</option>
                  {/* 🌟 FIX: Change uniqueSuppliersAll to pipelineSuppliers */}
                  {pipelineSuppliers.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="w-full lg:w-36">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Filter Phase status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`w-full border rounded px-2 py-1 text-xs font-black focus:outline-none ${isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"}`}>
                  <option value="ALL">ALL LIFECYCLES</option>
                  <option value="NOT REVIEWED">NOT REVIEWED</option>
            <option value="NOT SELECTED">NOT SELECTED</option>
            <option value="NOT SELECTED - Stock">NOT SELECTED - Stock</option>
            <option value="NOT SELECTED - Price">NOT SELECTED - Price</option>
            <option value="WAITING FOR MOV">WAITING FOR MOV</option>
            <option value="BUYING FROM ANOTHER SUPPLIER">BUYING FROM ANOTHER SUPPLIER</option>
                  
                  <option value="RFQ">RFQ</option>
                  <option value="RFQ UNDER REVIEW">RFQ UNDER REVIEW</option>
                  <option value="PENDING TO ORDER">PENDING TO ORDER</option>
                  <option value="ORDERED">ORDERED</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="COLLECTED">COLLECTED</option>
                  <option value="INVOICED">INVOICED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

{/* ===================================================================== */}
  {/* 👇 PASTE THIS NEW PIPELINE CONFIRMED DATE CALENDAR FILTER HERE */}
  {/* ===================================================================== */}
  <div className="w-full lg:w-44">
    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
      Pipeline Confirmed Date
    </label>
    <div className="relative flex items-center">
      <input 
        type="date" 
        value={filterPipelineDate} 
        onChange={(e) => setFilterPipelineDate(e.target.value)} 
        className={`w-full border rounded pl-2 pr-8 py-1 text-xs font-black focus:outline-none cursor-pointer ${
          isDarkMode ? "bg-[#060814] border-[#1e293b] text-white" : "bg-white border-slate-400 text-slate-900"
        }`}
        style={{ colorScheme: isDarkMode ? "dark" : "light" }}
      />
      {filterPipelineDate && (
        <button 
          onClick={() => setFilterPipelineDate("")}
          className="absolute right-2 text-[10px] text-red-500 font-bold hover:text-red-700 focus:outline-none"
          title="Clear Date"
        >
          ✕
        </button>
      )}
    </div>
  </div>

{/* ===================================================================== */}
  {/* 👇 NEW DYNAMIC BULK BATCH ASSIGNMENT CARD */}
  {/* ===================================================================== */}
  {selectedProductRowIds.size > 0 && (
    <div className={`w-full mt-4 p-4 rounded-lg border flex flex-col gap-3 animate-fadeIn ${
      isDarkMode ? "bg-[#0b0f19] border-slate-800" : "bg-indigo-50/70 border-indigo-100"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center bg-indigo-600 text-white text-xs font-black rounded-full h-5 w-5">
            {selectedProductRowIds.size}
          </span>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Batch Assignment Console
          </h4>
        </div>
        <p className="text-[10px] italic text-slate-400">
          *Blank inputs will preserve original values
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Supplier Reference Bulk Field */}
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Bulk Supplier Ref</label>
          <input
            type="text"
            placeholder="Set text..."
            value={bulkSupplierRef}
            onChange={(e) => setBulkSupplierRef(e.target.value)}
            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none font-medium ${
              isDarkMode ? "bg-[#060814] border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          />
        </div>

        {/* 2. Purchase Order Bulk Field */}
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Bulk PO #</label>
          <input
            type="text"
            placeholder="Set PO..."
            value={bulkPO}
            onChange={(e) => setBulkPO(e.target.value)}
            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none font-medium ${
              isDarkMode ? "bg-[#060814] border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          />
        </div>

        {/* 3. Invoice Number Bulk Field */}
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Bulk Invoice #</label>
          <input
            type="text"
            placeholder="Set Invoice..."
            value={bulkInvoice}
            onChange={(e) => setBulkInvoice(e.target.value)}
            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none font-medium ${
              isDarkMode ? "bg-[#060814] border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          />
        </div>

        {/* 4. Odoo Reference Bulk Field */}
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Bulk Odoo Ref</label>
          <input
            type="text"
            placeholder="Set Odoo..."
            value={bulkOdoo}
            onChange={(e) => setBulkOdoo(e.target.value)}
            className={`w-full border rounded px-2 py-1 text-xs focus:outline-none font-medium ${
              isDarkMode ? "bg-[#060814] border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          />
        </div>
      </div>

      <div className="flex justify-end mt-1">
        <button
          onClick={handleExecuteBulkAssignment}
          disabled={isPending}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-500 text-white font-black uppercase tracking-wider text-[10px] px-4 py-1.5 rounded shadow transition-colors"
        >
          {isPending ? "Syncing Grid..." : "Apply Changes To Selected Rows"}
        </button>
      </div>
    </div>
  )}

<button
    type="button"
    onClick={() => {
      setSelectedBackorderProduct(prodData); // 'p' or 'prodData' is your current row variable
      setQtyReceivedInput(Math.floor(Number(prodData.orderedQty || 0) * 0.66)); // Auto-fills with a sensible default guess (e.g. 40 out of 60)
      setIsBackorderOpen(true);
    }}
    className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider transition-colors"
  >
    Log Partial Receipt
  </button>

              <div className="ml-auto pt-3 flex items-center gap-2">
                <button type="button" onClick={triggerExcelSpreadsheetDownload} className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] flex items-center gap-1.5 tracking-wider shadow-sm"><Download size={13} /> Export Mail Format (.XLS)</button>
                
                {/* 🌟 NEW: Dynamic Grid Table Excel Downloader Button */}
  <button 
    type="button" 
    onClick={downloadPipelineTableToExcel} 
    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] flex items-center gap-1.5 tracking-wider shadow-sm transition-colors"
  >
    <Download size={13} /> Download Table (.XLSX)
  </button>
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
                      <th className="p-3 text-center">Supplier</th>
                      <th className="p-3 text-center">Supplier Reference</th>
                      <th className="p-3 text-center">Purchase Order (PO)</th>
                      <th className="p-3 text-right">Invoice Number</th>
                      <th className="p-3 text-center">Date Ordered</th>
                      <th className="p-3 text-center">Target Qty</th>
                      <th className="p-3 text-center">Target Price</th>
                      <th className="p-3 text-center">Ordered Qty</th>
                      <th className="p-3 text-right">Ordered Price</th>
                      <th className="p-3 text-right">Total Price</th>
                      <th className="p-3 text-right">Invoice Qty</th>
                      <th className="p-3 text-right">Invoice Price</th>
                      <th className="p-3 text-right">Odoo Reference</th>
                      <th className="p-3 text-right">Net Profit</th>
                      <th className="p-3 text-center">Pipeline Status</th>
                      <th className="p-3">Internal Log Commentary</th>
                      <th className="p-3 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
              <tbody>
  {pipelineFilteredProducts.length > 0 ? (
    pipelineFilteredProducts.map((p) => {
      // Safely extract numeric variables
      const orderQty = Number(p.orderQty) || 0;
      const orderedPrice = Number(p.orderedPrice) || 0;
      const targetQty = Number(p.targetQty) || 0;
      const unitProfit = Number(p.profit) || 0;

      // 1. Calculate Total Price based on Ordered Quantity
      const totalPrice = orderQty * orderedPrice;

      // 2. FIXED NET PROFIT LOGIC: Use orderQty if available, fallback to targetQty if blank
      const activeQuantityForProfit = orderQty > 0 ? orderQty : targetQty;
      const netProfit = activeQuantityForProfit * unitProfit;

      return (
        <tr 
          key={p.id} 
          className={`text-[11px] border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
            isDarkMode ? "border-slate-900 text-slate-300" : "border-slate-200 text-slate-800"
          }`}
        >
          {/* 1. CHECKBOX SELECTION CELL */}
          <td className="p-3 text-center w-10">
            <input 
              type="checkbox" 
              checked={selectedProductRowIds.has(p.id)} 
              onChange={() => {
                const updated = new Set(selectedProductRowIds);
                if (updated.has(p.id)) updated.delete(p.id);
                else updated.add(p.id);
                setSelectedProductRowIds(updated);
              }}
              className="rounded cursor-pointer"
            />
          </td>

          {/* 2. ASIN */}
          <td className={`p-3 font-bold font-mono tracking-tight ${
  isDarkMode ? "text-white" : "text-slate-900"
}`}>
  {p.asin}
</td>

          {/* 3. UPC */}
          <td className={`p-3 font-mono font-medium ${
  isDarkMode ? "text-slate-400" : "text-slate-700"
}`}>
  {p.upc || "-"}
</td>

          {/* 4. SOURCE CODE */}
          <td className={`p-3 font-semibold ${
  isDarkMode ? "text-slate-400" : "text-slate-800"
}`}>
  {p.sourceCode || "N/A"}
</td>

          
          {/* 5. PRODUCT NAME TITLE (FIXED: Wraps text fully to next lines & corrected dark mode class syntax) */}
<td className="p-3 min-w-[200px] max-w-[400px]">
  <div className={`font-semibold text-[10px] mb-0.5 ${
    isDarkMode ? "text-slate-500" : "text-slate-400"
  }`}>
    {p.brand}
  </div>
  <div className={`font-medium text-xs whitespace-normal break-words leading-tight ${
    isDarkMode ? "text-white" : "text-slate-900"
  }`}>
    {p.name}
  </div>
</td>

          {/* 6. SUPPLIER (FIXED: Displays the string vendor value, not tracking row indices) */}
          <td className={`p-3 text-center font-bold ${
  isDarkMode ? "text-slate-300" : "text-slate-900"
}`}>
  {p.sourceUrl || "Unknown"}
</td>

          {/* 7. SUPPLIER REFERENCE */}
          

          <td className="p-3 text-center">
            <input 
              type="text" 
              value={p.supplierReference || ""} 
              onChange={(e) => handleLiveRowChange(p.id, 'supplierReference', e.target.value)}
    className={`w-24 px-1.5 py-0.5 text-center border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            />
          </td>

          {/* 8. PURCHASE ORDER (PO) */}
          <td className="p-3 text-center">
            <input 
              type="text" 
              defaultValue={p.purchaseOrderNumber || ""} 
              onBlur={(e) => handleInlineStringBlur(p.id, 'purchaseOrderNumber', e.target.value)}
              placeholder="PO-"
              className={`w-20 px-1.5 py-0.5 text-center border rounded ${themeInputBg}`}
            />
          </td>

          {/* 9. INVOICE NUMBER (FIXED: Independent form cell, starts blank) */}
          <td className="p-3 text-right">
            <input 
              type="text" 
              defaultValue={p.invoiceNumber || ""} 
              onBlur={(e) => handleInlineStringBlur(p.id, 'invoiceNumber', e.target.value)}
              placeholder="INV-"
              className={`w-20 px-1.5 py-0.5 text-right border rounded ${themeInputBg}`}
            />
          </td>

          {/* 10. DATE ORDERED */}
          
<td className="p-3 text-center">
  <input 
    type="date" 
    value={p.dateOrderedStr || ""} 
    onChange={(e) => handleLiveRowChange(p.id, 'dateOrderedStr', e.target.value)}
    className={`w-28 px-1.5 py-0.5 text-center border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} 
    style={{ colorScheme: isDarkMode ? "dark" : "light" }}
  />
</td>

          {/* 11. TARGET QTY */}
          <td className="p-3 text-center font-mono font-medium">
            {p.targetQty !== "" ? p.targetQty : "-"}
          </td>

          {/* 12. TARGET PRICE */}
          <td className="p-3 text-center font-mono text-slate-500">
          {p.targetPrice ? Number(p.targetPrice).toFixed(2) : "-"}
          </td>

          {/* 13. ORDERED QTY INPUT FIELD */}
<td className="p-3 text-center">
  <input 
    type="text" 
    inputMode="numeric"
    pattern="[0-9]*"
    // 👇 If value is 0, display an empty string so users see a clean blank field
    value={p.orderQty === 0 ? "" : p.orderQty} 
    onChange={(e) => handleLiveQtyChange(p.id, e.target.value)}
    onBlur={(e) => handleInlineNumberBlur(p.id, 'orderQty', Number(e.target.value) || 0)}
    className={`w-10 px-1.5 py-0.5 border rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
      isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
    }`}
  />
</td>

{/* 14. ORDERED PRICE INPUT FIELD */}
<td className="p-3 text-right">
  <EditableCell
    value={p.orderedPrice}
    inputMode="decimal"
    isDarkMode={isDarkMode}
    className="text-right"
    onSave={(val: string) => handleInlineNumberBlur(p.id, 'orderedPrice', Number(val) || 0)}
  />
</td>

          {/* 15. TOTAL PRICE */}
          <td className={`p-3 text-center font-mono font-bold ${
  isDarkMode ? "text-slate-400" : "text-slate-700"
}`}>
            {totalPrice.toFixed(2)}
          </td>

{/* 15a. INVOICE QTY INPUT FIELD */}
<td className="p-3 text-center font-mono font-bold">
  <EditableCell
    value={p.invoiceQty}
    inputMode="numeric"
    isDarkMode={isDarkMode}
    className="text-center font-mono"
    onSave={(val: string) => handleInlineNumberBlur(p.id, 'invoiceQty', Number(val) || 0)}
  />
</td>
          
{/* 15b. INVOICE PRICE INPUT FIELD */}
<td className="p-3 text-center font-mono font-bold">
  <EditableCell
    value={p.invoicePrice}
    inputMode="decimal"
    isDarkMode={isDarkMode}
    className="text-right font-mono"
    onSave={(val: string) => handleInlineNumberBlur(p.id, 'invoicePrice', Number(val) || 0)}
  />
</td>

          {/* 16. ODOO REFERENCE (FIXED: Added binding state and onBlur tracking handler) */}
<td className="p-3 text-right">
  <input 
    type="text" 
    defaultValue={p.odooReference || ""}
    placeholder="Odoo Ref"
    onBlur={(e) => handleInlineStringBlur(p.id, 'purchaseOrderNumber', e.target.value)}
    className={`w-24 px-1.5 py-0.5 border rounded text-right ${themeInputBg}`}
  />
</td>

          {/* 17. NET PROFIT */}
          <td className="p-3 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">
          {Number(netProfit || 0).toFixed(2)}
          </td>

          {/* 18. PIPELINE STATUS (FIXED: Complete 15-option status array included) */}
          <td className="p-3 text-center">
            <select 
              value={p.status || "RFQ"} 
              onChange={(e) => handleInlineStatusChange(p.id, e.target.value as any)} 
              className={`text-xs px-1 py-0.5 rounded border font-black ${
                isDarkMode ? "bg-slate-900 border-slate-800 text-indigo-400" : "bg-white border-slate-300 text-indigo-950"
              }`}
            >
              <option value="NOT REVIEWED">NOT REVIEWED</option>
              <option value="NOT SELECTED">NOT SELECTED</option>
              <option value="NOT SELECTED - Stock">NOT SELECTED - Stock</option>
              <option value="NOT SELECTED - Price">NOT SELECTED - Price</option>
              <option value="WAITING FOR MOV">WAITING FOR MOV</option>
              <option value="BUYING FROM ANOTHER SUPPLIER">BUYING FROM ANOTHER SUPPLIER</option>
              <option value="RFQ">RFQ</option>
              <option value="RFQ UNDER REVIEW">RFQ UNDER REVIEW</option>
              <option value="PENDING TO ORDER">PENDING TO ORDER</option>
              <option value="ORDERED">ORDERED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="COLLECTED">COLLECTED</option>
              <option value="INVOICED">INVOICED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </td>

          {/* 19. INTERNAL LOG COMMENTARY */}
          {/* INTERNAL LOG COMMENTARY */}
<td className="p-3 text-center">
  <input 
    type="text" 
    value={p.comment || ""} 
    onChange={(e) => handleLiveRowChange(p.id, 'comment', e.target.value)}
    className={`w-40 px-2 py-0.5 text-left border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} 
  />
</td>

{/* EXPLICIT SAVE ACTION CELL */}
<td className="p-3 text-center">
  <button 
    onClick={() => handleSaveRow(p)}
    disabled={isPending}
    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase px-3 py-1.5 rounded shadow-md transition-colors disabled:opacity-50"
  >
    Save
  </button>
</td>

        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={19} className="p-8 text-center text-slate-500 font-bold italic">
        No rows match pipeline layout filters.
      </td>
    </tr>
  )}
</tbody>
</table>
              </div>
            </div>

          </div>
        )}

{/* ===================================================================== */}
  {/* 🚀 PASTE STEP 2: THE PROFORMA VERIFIER WORKSPACE LAYOUT RIGHT HERE:    */}
  {/* ===================================================================== */}
  {activeWindow === 3 && (
    <div className="space-y-6 animate-fadeIn">
      {/* Control Header Grid Card */}
      <div className={`p-6 rounded-2xl border shadow-xs ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}>
        <h2 className="text-sm font-black uppercase tracking-wider text-indigo-500 mb-4">
          Proforma Invoice Multi-Key Reconciliation Engine
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PO Target Match Selector Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500">Target Purchase Order #</label>
            <input
              type="text"
              placeholder="e.g. PO-1044"
              id="targetPoInput"
              className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            />
          </div>

          {/* File Dropzone Selector Field (Excel) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500">Upload Supplier Excel Sheet</label>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const poNum = (document.getElementById("targetPoInput") as HTMLInputElement)?.value;
                if (!file || !poNum) return alert("Please specify a target PO Number first!");
                
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const bstr = evt.target?.result;
                  const wb = XLSX.read(bstr, { type: "binary" });
                  const wsname = wb.SheetNames[0];
                  const ws = wb.Sheets[wsname];
                  const data = XLSX.utils.sheet_to_json(ws) as any[];
                  
                  processUploadedRows(data.map(row => ({
                    identifier: String(row.UPC || row["Source Code"] || row.ItemCode || Object.values(row)[0] || ""),
                    qty: Number(row.Qty || row.Quantity || row["Order Qty"] || 0),
                    price: Number(row.Price || row.Cost || row["Unit Price"] || 0)
                  })), poNum);
                };
                reader.readAsBinaryString(file);
              }}
              className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
            />
          </div>

          {/* Copy-Paste Raw Workspace Entry Frame (PDF Data Capture) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500">Or Paste Raw Copy-Pasted PDF Lines</label>
            <textarea
              placeholder="Paste text from PDF here... (Format: Code [space] Qty [space] Price)"
              rows={2}
              onChange={(e) => {
                const text = e.target.value;
                const poNum = (document.getElementById("targetPoInput") as HTMLInputElement)?.value;
                if (!text || !poNum) return;

                const lines = text.split("\n");
                const parsedRows = lines.map(line => {
                  const parts = line.trim().split(/\s+/);
                  if (parts.length < 3) return null;
                  
                  return {
                    identifier: parts[0],
                    qty: Number(parts[parts.length - 2]) || 0,
                    price: Number(parts[parts.length - 1].replace(/[^0-9.]/g, "")) || 0
                  };
                }).filter(Boolean);

                processUploadedRows(parsedRows as any[], poNum);
              }}
              className={`w-full border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                isDarkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-300 text-slate-600"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Verification Evaluation Data Grid View Panel */}
      <div className={`border rounded-2xl overflow-hidden shadow-xs ${isDarkMode ? "bg-slate-900/20 border-slate-800" : "bg-white border-slate-200"}`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`text-[10px] font-black uppercase tracking-wider border-b ${isDarkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
              <th className="p-3">Match Status</th>
              <th className="p-3">Supplier Identifier Token</th>
              <th className="p-3 text-center">System SKU Reference</th>
              <th className="p-3 text-center">Expected Qty</th>
              <th className="p-3 text-center">Supplier Qty</th>
              <th className="p-3 text-right">Expected Price</th>
              <th className="p-3 text-right">Supplier Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400/10 font-mono text-xs">
            {reconciliationReport.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 font-sans font-bold">
                  No proforma data imported yet. Select a target PO number and upload your spreadsheet layout or paste PDF text above.
                </td>
              </tr>
            ) : (
              reconciliationReport.map((row, idx) => {
                const isMatch = row.status === "MATCH";
                const isPriceErr = row.status === "PRICE_MISMATCH";
                const isQtyErr = row.status === "QTY_MISMATCH";
                
                let badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
                if (isMatch) badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                if (isPriceErr) badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                if (isQtyErr) badgeColor = "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"; // fallback support structural key matching validation checks

                return (
                  <tr key={idx} className={`transition-colors ${isDarkMode ? "hover:bg-slate-900/40" : "hover:bg-slate-50"}`}>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${
                        isMatch ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                        isPriceErr ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                        isQtyErr ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-400">{row.identifier}</td>
                    <td className="p-3 text-center font-sans font-semibold">{row.systemProduct?.sku || "—"}</td>
                    <td className="p-3 text-center text-slate-400">{row.expectedQty || 0}</td>
                    <td className={`p-3 text-center font-black ${isQtyErr ? "text-cyan-500" : ""}`}>{row.actualQty}</td>
                    <td className="p-3 text-right text-slate-400">£{(row.expectedPrice || 0).toFixed(2)}</td>
                    <td className={`p-3 text-right font-black ${isPriceErr ? "text-amber-500" : ""}`}>£{(row.actualPrice || 0).toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {reconciliationReport.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleApplyProformaToInvoices}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all"
          >
            Push Proforma Metrics directly into Actual Invoices
          </button>
        </div>
      )}
    </div>
  )}
  {/* ===================================================================== */}

      </main>

{/* ===================================================================== */}
  {/* 🌟 NEW: PARTIAL SHIPMENT & AUTOMATED BACKORDER SPLIT MODAL WINDOW      */}
  {/* ===================================================================== */}
  {isBackorderOpen && selectedBackorderProduct && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className={`w-full max-w-md rounded-xl border p-6 shadow-2xl transition-all ${isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}>
        
        {/* Header Section */}
        <div className="border-b border-slate-400/10 pb-3 mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-indigo-500">Log Partial Supplier Delivery</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">Product ASIN: {selectedBackorderProduct.asin}</p>
        </div>

        {/* Informative Grid Metadata */}
        <div className="space-y-3 font-mono text-[11px]">
          <div className="flex justify-between border-b border-slate-400/10 pb-1.5">
            <span className="text-slate-500 font-bold uppercase">Original Ordered Quantity:</span>
            <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">
              {selectedBackorderProduct.orderedQty || 0} pcs
            </span>
          </div>

          {/* Interactive Input Layer */}
          <div className="pt-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              Quantity Received Actually (Arrived Today):
            </label>
            <input
              type="number"
              min={1}
              max={Number(selectedBackorderProduct.orderedQty || 1) - 1}
              value={qtyReceivedInput}
              onChange={(e) => setQtyReceivedInput(Math.max(0, parseInt(e.target.value) || 0))}
              className={`w-full p-2.5 text-sm rounded-lg border font-bold font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
            />
          </div>

          {/* Dynamic Math Calculation Output Window Block */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-medium leading-relaxed mt-4">
            ⚠️ <strong>Backorder Trigger Notice:</strong> Setting this will reduce the original row delivery quantity down to <span className="font-bold underline">{qtyReceivedInput} pcs</span>. A new clone tracking record of <span className="font-bold underline">{Number(selectedBackorderProduct.orderedQty || 0) - qtyReceivedInput} pcs</span> will automatically be generated at the bottom of your Google Sheet.
          </div>
        </div>

        {/* Action Window Control Panel Controls */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-400/10">
          <button
            type="button"
            disabled={isProcessingBackorder}
            onClick={() => {
              setIsBackorderOpen(false);
              setSelectedBackorderProduct(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isProcessingBackorder}
            onClick={handleConfirmBackorderSplit}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition-colors disabled:opacity-50"
          >
            {isProcessingBackorder ? "Processing Split..." : "Confirm Split Receipt"}
          </button>
        </div>

      </div>
    </div>
  )}

    </div>
  );
}