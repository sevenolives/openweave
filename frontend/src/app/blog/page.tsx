import { Metadata } from 'next';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.openweave.dev/api';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  author_name: string;
  featured_image_url: string;
  tags: string;
  published_at: string;
}

async function getPosts(page = 1): Promise<{ results: BlogPost[]; count: number; next: string | null; previous: string | null }> {
  const res = await fetch(`${API_BASE}/blog/?page=${page}&page_size=12`, { next: { revalidate: 60 } });
  if (!res.ok) return { results: [], count: 0, next: null, previous: null };
  return res.json();
}

export const metadata: Metadata = {
  title: 'Blog — AI Agent Governance Insights',
  description: 'Insights on AI agent governance, execution governance, autonomous agent control, multi-agent coordination, and deterministic agent execution from the OpenClaw Governance team.',
  alternates: {
    canonical: 'https://openweave.dev/blog',
  },
  openGraph: {
    title: 'Blog | OpenClaw Governance',
    description: 'Insights on AI agent governance, autonomous agent control, and deterministic execution.',
    url: 'https://openweave.dev/blog',
    type: 'website',
  },
};

export default async function BlogListPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const data = await getPosts(page);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PublicNav />

      <main className="max-w-4xl mx-auto px-4 py-16">
        <header className="mb-12">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-3">Blog</p>
          <h1 className="text-4xl font-bold">Insights on Execution Governance</h1>
          <p className="mt-3 text-gray-400 text-lg">Thinking about autonomous systems, agent coordination, and deterministic execution.</p>
        </header>

        {data.results.length === 0 ? (
          <p className="text-gray-500">No posts yet. Check back soon.</p>
        ) : (
          <div className="space-y-8">
            {data.results.map((post) => (
              <article key={post.id} className="group border border-white/5 rounded-xl p-6 hover:border-emerald-500/30 transition">
                <Link href={`/blog/${post.slug}`}>
                  <div className="flex flex-col md:flex-row gap-6">
                    {post.featured_image_url && (
                      <img src={post.featured_image_url} alt={post.title} className="w-full md:w-48 h-32 object-cover rounded-lg" />
                    )}
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-white group-hover:text-emerald-400 transition">{post.title}</h2>
                      <p className="mt-2 text-gray-400 text-sm leading-relaxed">{post.excerpt}</p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                        {post.author_name && <span>{post.author_name}</span>}
                        <time dateTime={post.published_at}>
                          {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </time>
                        {post.tags && (
                          <div className="flex gap-2">
                            {post.tags.split(',').slice(0, 3).map((tag) => (
                              <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-gray-400">{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data.next || data.previous) && (
          <div className="mt-12 flex justify-center gap-4">
            {data.previous && (
              <Link href={`/blog?page=${page - 1}`} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition">← Previous</Link>
            )}
            {data.next && (
              <Link href={`/blog?page=${page + 1}`} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition">Next →</Link>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} OpenClaw Governance — Execution Governance for Autonomous Systems
        </div>
      </footer>
    </div>
  );
}
