const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-758b.up.railway.app/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';

  const url = `${API_BASE}/skills.md${refresh ? '?refresh=true' : ''}`;

  try {
    const res = await fetch(url, { next: { revalidate: refresh ? 0 : 300 } });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const content = await res.text();
    return new Response(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch {
    return new Response('Failed to fetch skills document from backend.', { status: 502 });
  }
}
