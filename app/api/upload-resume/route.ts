import { writeFile } from 'fs/promises';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { NextResponse } from 'next/server';

export const POST = async (req: Request) => {
  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid or missing PDF file' }, { status: 400 });
    }
    const forwardFormData = new FormData();
    forwardFormData.append('resume', file);

    const FLASK_API_URL = process.env.PDF_PARSE ?? '';

    const flaskResponse = await fetch(FLASK_API_URL, {
      method: 'POST',
      body: forwardFormData,
    });

    if (!flaskResponse.ok) {
      const errorJson = await flaskResponse.json();
      return NextResponse.json({ error: `Flask API error: ${errorJson.error || 'Unknown error'}` }, { status: 500 });
    }

    const { resumeId, parsedText } = await flaskResponse.json();

    if (!parsedText) {
      return NextResponse.json({ error: 'No parsed text received from Flask API' }, { status: 500 });
    }

    const savePath = path.join('/tmp', `resume-${resumeId}.txt`);
    await writeFile(savePath, parsedText, 'utf-8');

    return NextResponse.json({
      message: 'Resume parsed and uploaded via Flask API',
      resumeId,
      textLength: parsedText.length,
      parsedText,
    });
  } catch (error) {
    console.error('Error in Next.js upload handler:', error);
    return NextResponse.json({ error: 'Failed to upload and parse resume' }, { status: 500 });
  }
};
