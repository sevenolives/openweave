import Link from 'next/link';

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
        <span>
          © {new Date().getFullYear()} OpenWeave — Execution Governance for Autonomous Systems ·{' '}
          <a href="https://sevenolives.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition">
            sevenolives.com
          </a>
        </span>
        <div className="flex gap-6">
          <Link href="/pricing" className="hover:text-gray-400 transition">Pricing</Link>
          <Link href="/compare" className="hover:text-gray-400 transition">Compare</Link>
          <Link href="/policies" className="hover:text-gray-400 transition">Policies</Link>
          <a href="https://backend.openweave.dev/api/v1/docs/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition">API</a>
        </div>
      </div>
    </footer>
  );
}
