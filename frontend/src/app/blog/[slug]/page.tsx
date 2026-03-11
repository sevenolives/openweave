import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-758b.up.railway.app/api';
const SITE_URL = 'https://openweave.dev';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author_name: string;
  featured_image_url: string;
  meta_title: string;
  meta_description: string;
  tags: string;
  published_at: string;
  updated_at: string;
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const res = await fetch(`${API_BASE}/blog/${slug}/`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Post Not Found' };

  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt;
  const url = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: `${title} | OpenWeave`,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: post.published_at,
      ...(post.featured_image_url ? { images: [{ url: post.featured_image_url }] } : {}),
    },
    alternates: { canonical: url },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description || post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { '@type': 'Person', name: post.author_name || 'OpenWeave Team' },
    publisher: { '@type': 'Organization', name: 'OpenWeave' },
    url: `${SITE_URL}/blog/${post.slug}`,
    ...(post.featured_image_url ? { image: post.featured_image_url } : {}),
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">OpenWeave</Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-sm text-emerald-400 font-medium">Blog</Link>
            <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">Sign In →</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/blog" className="text-sm text-gray-500 hover:text-emerald-400 transition mb-8 inline-block">← Back to Blog</Link>

        <article>
          <header className="mb-8">
            {post.tags && (
              <div className="flex gap-2 mb-4">
                {post.tags.split(',').map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">{tag.trim()}</span>
                ))}
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              {post.author_name && <span>By {post.author_name}</span>}
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </div>
          </header>

          {post.featured_image_url && (
            <img src={post.featured_image_url} alt={post.title} className="w-full rounded-xl mb-8" />
          )}

          <div
            className="prose prose-invert prose-emerald max-w-none
              prose-headings:font-semibold prose-headings:text-white
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
              prose-li:text-gray-300 prose-code:text-emerald-400 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
      </main>

      <footer className="border-t border-white/5 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} OpenWeave — Execution Governance for Autonomous Systems
        </div>
      </footer>
    </div>
  );
}
