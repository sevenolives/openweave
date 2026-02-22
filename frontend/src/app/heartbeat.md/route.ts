const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-758b.up.railway.app/api';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/skills/heartbeat.md`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const content = await res.text();
    return new Response(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch {
    return new Response('Failed to fetch heartbeat document from backend.', { status: 502 });
  }
}
