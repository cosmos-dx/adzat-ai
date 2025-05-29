import { writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import os from 'os';
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING ?? '';
const CONTAINER_NAME = 'resumes';

// Function to generate SAS URL
function generateSasUrl(blobName: string): string {
  const connectionString = AZURE_STORAGE_CONNECTION_STRING;
  const [accountName, accountKey] = connectionString
    .split(';')
    .filter(part => part.startsWith('AccountName=') || part.startsWith('AccountKey='))
    .map(part => part.split('=')[1]);

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
  );

  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(blobName);

  // Set SAS token to expire in 24 hours
  const sasOptions = {
    containerName: CONTAINER_NAME,
    blobName: blobName,
    permissions: BlobSASPermissions.parse("r"), // Read only
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 24 * 60 * 60 * 1000), // 24 hours from now
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();

  return `${blobClient.url}?${sasToken}`;
}

// Function to upload file to Azure Blob Storage
async function uploadToAzureBlob(file: File, resumeId: string): Promise<{ blobUrl: string; sasUrl: string }> {
  try {
    // Create the BlobServiceClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    // Create a unique blob name
    const blobName = `resume-${resumeId}.pdf`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload the file
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: file.type }
    });

    // Generate SAS URL
    const sasUrl = generateSasUrl(blobName);

    return {
      blobUrl: blockBlobClient.url,
      sasUrl
    };
  } catch (error) {
    console.error('Error uploading to Azure Blob Storage:', error);
    throw error;
  }
}

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
      return NextResponse.json({ error: `Flask API error: ${errorJson.error ?? 'Unknown error'}` }, { status: 500 });
    }

    const { resumeId, parsedText } = await flaskResponse.json();

    if (!parsedText) {
      return NextResponse.json({ error: 'No parsed text received from Flask API' }, { status: 500 });
    }

    // Upload the PDF to Azure Blob Storage
    const { blobUrl, sasUrl } = await uploadToAzureBlob(file, resumeId);

    // Log the first 500 characters of the parsed text
    console.log('Parsed Resume Text (first 500 chars):', parsedText.substring(0, 500));
    console.log('Total resume text length:', parsedText.length);

    // Save the parsed text locally (optional, you can remove this if not needed)
    const savePath = path.join(os.tmpdir(), `resume-${resumeId}.txt`);
    await writeFile(savePath, parsedText, 'utf-8');
    console.log('Saved resume to:', savePath);

    return NextResponse.json({
      message: 'Resume parsed and uploaded successfully',
      resumeId,
      textLength: parsedText.length,
      parsedText: parsedText.substring(0, 500), // Include first 500 chars in response for debugging
      blobUrl, // The direct blob URL (for reference)
      sasUrl, // The SAS URL that can be used to access the resume
    });
  } catch (error) {
    console.error('Error in upload-resume:', error);
    return NextResponse.json({ error: 'Failed to upload and parse resume' }, { status: 500 });
  }
};
