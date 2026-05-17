"use client";

import { useState, useMemo, useTransition } from "react";
import { createProduct } from "./actions";

interface ProductItem {
  id: string;
  asin: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  status: string;
  supplier: string | null;
  costPrice: number | null;
  estimatedProfit: number | null;
  sales?: {
    total30d: number;
  } | null;
}

interface InventoryClientProps {
  initialProducts: ProductItem[];
  suppliers: string[];
}

export default function InventoryClient({ initialProducts, suppliers }: InventoryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");

  // Memoized client filter logic
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      const matchesSupplier = selectedSupplier === "" || product.supplier === selectedSupplier;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(searchLower) ||
        product.asin.toLowerCase().includes(searchLower) ||
        (product.sku && product.sku.toLowerCase().includes(searchLower));

      return matchesSupplier && matchesSearch;
    });
  }, [searchTerm, selectedSupplier, initialProducts]);

  // Form submission handler linking to our Server Action
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await createProduct(formData);
        setIsModalOpen(false); // Close modal on complete success
      } catch (error: any) {
        setFormError(error.message || "Failed to save product record.");
      }
    });
  }

  return (
    <>
      {/* Header Section */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Amazon Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Showing {filteredProducts.length} of {initialProducts.length} tracked products
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors self-start sm:self-auto"
        >
          + Add New Product
        </button>
      </div>

      {/* Filter Controls Widget */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Search Products</label>
          <input
            type="text"
            placeholder="Search by Title, ASIN, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900"
          />
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Filter by Supplier</label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900"
          >
            <option value="">All Suppliers ({suppliers.length})</option>
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex justify-between items-start gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {product.status}
                </span>
                {product.supplier && (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    🏢 {product.supplier}
                  </span>
                )}
              </div>

              <h2 className="font-semibold text-gray-800 line-clamp-2 mt-3 min-h-[2.75rem]">
                {product.name}
              </h2>
              
              <div className="mt-2 space-y-0.5 text-xs font-mono text-gray-400">
                <p>ASIN: <span className="text-gray-600 font-medium">{product.asin}</span></p>
                <p>SKU: <span className="text-gray-600 font-medium">{product.sku || "—"}</span></p>
              </div>
            </div>

            <div className="border-t border-gray-100 mt-5 pt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Unit Cost</span>
                <span className="font-medium text-sm text-gray-900">
                  {product.costPrice ? `$${product.costPrice.toFixed(2)}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">30d Sales</span>
                <span className="font-medium text-sm text-gray-900">
                  {product.sales?.total30d ?? 0} units
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Est. Profit</span>
                <span className={`font-semibold text-sm ${product.estimatedProfit && product.estimatedProfit > 0 ? "text-emerald-600" : "text-gray-900"}`}>
                  {product.estimatedProfit ? `$${product.estimatedProfit.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Creation Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 p-6 relative">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Track New Amazon Product</h3>
            
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium mb-4">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Product Title *</label>
                <input required type="text" name="name" placeholder="e.g. Wireless Charger Station" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ASIN *</label>
                  <input required type="text" name="asin" placeholder="B0XXXXXXXX" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Seller SKU</label>
                  <input type="text" name="sku" placeholder="SKU-XYZ" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Code</label>
                  <input type="text" name="supplier" placeholder="PHCT" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <input type="text" name="category" placeholder="Electronics" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Cost Price ($)</label>
                  <input type="number" step="0.01" name="costPrice" placeholder="0.00" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Est. Profit ($)</label>
                  <input type="number" step="0.01" name="estimatedProfit" placeholder="0.00" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 rounded-lg transition-colors shadow-sm"
                >
                  {isPending ? "Saving..." : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}