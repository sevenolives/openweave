import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
        <p className="text-lg text-gray-400 mb-6">Page not found</p>
        <Link href="/" className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
          Go home
        </Link>
      </div>
    </div>
  );
}
