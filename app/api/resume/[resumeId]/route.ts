import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';

export async function GET(request: NextRequest) {
  const resumeId = request.nextUrl.searchParams.get('resumeId');

  try {
    const filePath = path.join('/tmp', `resume-${resumeId}.txt`);
    const resumeText = await readFile(filePath, 'utf-8');
    return NextResponse.json({ resumeText });
  } catch (error) {
    console.error(`Error retrieving resume ${resumeId}:`, error);

    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to retrieve resume' }, { status: 500 });
  }
}
