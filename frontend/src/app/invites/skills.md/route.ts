import { generateSkillsMd } from '@/lib/generateSkills';

export async function GET() {
  try {
    const content = await generateSkillsMd();
    return new Response(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    return new Response('Failed to generate skills document.', { status: 500 });
  }
}
