import { generateSkillsMd } from '@/lib/generateSkills';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CACHE_PATH = path.join(process.cwd(), '.next', 'cache', 'skills.md');

async function getCached(): Promise<string | null> {
  try {
    if (existsSync(CACHE_PATH)) {
      return await readFile(CACHE_PATH, 'utf-8');
    }
  } catch {}
  return null;
}

async function writeCache(content: string) {
  try {
    await mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, content, 'utf-8');
  } catch {}
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';

  try {
    // If not refreshing, try cache first
    if (!refresh) {
      const cached = await getCached();
      if (cached) {
        return new Response(cached, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
      }
    }

    // Generate from schema (first request or refresh)
    const content = await generateSkillsMd();
    await writeCache(content);
    return new Response(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    // Fallback to static file if schema fetch fails
    try {
      const staticPath = path.join(process.cwd(), 'public', 'skills.md');
      const fallback = await readFile(staticPath, 'utf-8');
      return new Response(fallback, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    } catch {
      return new Response('Failed to generate skills document.', { status: 500 });
    }
  }
}
