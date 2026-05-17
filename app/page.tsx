import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold mb-4">
          📦
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Amazon Inventory Manager
        </h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Welcome to your inventory control system. Connect to your live metrics catalog to evaluate margins, monitor margins, and track item statuses.
        </p>
        
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-flex w-full justify-center items-center bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm py-3 px-4 rounded-xl transition-colors shadow-sm"
          >
            Open Inventory Dashboard &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}