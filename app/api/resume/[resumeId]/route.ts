import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';

export async function GET(
  req: Request,
  context: { params: { resumeId: string } }
) {
  const { resumeId } = context.params;

  try {
    const filePath = path.join('/tmp', `resume-${resumeId}.txt`);
    const resumeText = await readFile(filePath, 'utf-8');

    return NextResponse.json({ resumeText });
  } catch (error) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }
}
