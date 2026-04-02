'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-400 mb-4">500</h1>
        <p className="text-lg text-gray-400 mb-2">Something went wrong</p>
        <p className="text-sm text-gray-500 mb-6">{error.message}</p>
        <button onClick={reset} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
          Try again
        </button>
      </div>
    </div>
  );
}
