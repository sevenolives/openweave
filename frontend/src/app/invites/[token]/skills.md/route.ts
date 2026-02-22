import { generateSkillsMd } from '@/lib/generateSkills';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const content = await generateSkillsMd(token);
    return new Response(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    return new Response('Failed to generate skills document.', { status: 500 });
  }
}
