import { AccessToken, AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import fs from 'fs';
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

// Validate environment variables
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_HTTP_URL = process.env.LIVEKIT_HTTP_URL || LIVEKIT_URL?.replace('wss://', 'https://');
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING ?? '';
const CONTAINER_NAME = 'resumes';

if (!API_KEY || !API_SECRET || !LIVEKIT_URL || !LIVEKIT_HTTP_URL) {
  console.error('Missing required environment variables:', {
    hasApiKey: !!API_KEY,
    hasApiSecret: !!API_SECRET,
    hasLivekitUrl: !!LIVEKIT_URL,
    hasLivekitHttpUrl: !!LIVEKIT_HTTP_URL
  });
  throw new Error('Missing required LiveKit environment variables');
}

// Use the same consistent path
const RESUME_DIR = '/tmp';

export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
  resumeId?: string;
  resumeText?: string;
  resumeUrl?: string;
};

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

async function createRoomWithMetadata(roomName: string, metadata: any) {
  console.log('Creating room with metadata:', {
    roomName,
    metadata,
    url: `${LIVEKIT_HTTP_URL}/v1/rooms/${roomName}`,
    apiKey: API_KEY?.substring(0, 5) + '...',
    apiSecret: API_SECRET?.substring(0, 5) + '...'
  });

  // Create a JWT token for the API request
  const at = new AccessToken(API_KEY!, API_SECRET!, {
    identity: 'api',
    ttl: "1m",
  });
  const token = await at.toJwt();

  // Ensure metadata is properly stringified
  const metadataString = JSON.stringify(metadata);
  console.log('Sending metadata to LiveKit:', metadataString);

  const response = await fetch(`${LIVEKIT_HTTP_URL}/v1/rooms/${roomName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata: metadataString,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LiveKit API Error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url: `${LIVEKIT_HTTP_URL}/v1/rooms/${roomName}`,
      headers: {
        'Authorization': `Bearer ${token.substring(0, 20)}...`,
        'Content-Type': 'application/json',
      }
    });
    throw new Error(`Failed to create room: ${response.statusText}. ${errorText}`);
  }

  // Check content type to determine how to parse the response
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  } else {
    // For plain text responses like "OK"
    const text = await response.text();
    return { status: text };
  }
}

export async function GET(req: Request) {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error("Missing LiveKit environment variables");
    }

    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get("resumeId") ?? undefined;
    console.log('Received request for resumeId:', resumeId);

    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    // Create room with metadata if resumeId is provided
    if (resumeId) {
      try {
        await createRoomWithMetadata(roomName, { resumeId });
        console.log('Created room with metadata:', { roomName, resumeId });
      } catch (error) {
        console.error('Error creating room with metadata:', error);
        throw error;
      }
    }

    const participantToken = await createParticipantToken(
      { identity: participantIdentity },
      roomName
    );

    let resumeText: string | undefined = undefined;
    let resumeUrl: string | undefined = undefined;

    if (resumeId) {
      try {
        // Generate SAS URL for the resume
        const blobName = `resume-${resumeId}.pdf`;
        resumeUrl = generateSasUrl(blobName);
        console.log('Generated SAS URL for resume:', resumeUrl);

        const filePath = path.join(RESUME_DIR, `resume-${resumeId}.txt`);
        console.log('Attempting to read resume from:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.error('Resume file does not exist at path:', filePath);
          // List files in the directory to debug
          const files = fs.readdirSync(RESUME_DIR);
          console.log('Files in directory:', files);
        } else {
          resumeText = await readFile(filePath, "utf-8");
          console.log('Successfully read resume file');
          console.log('Resume text being passed to interview (first 500 chars):', resumeText.substring(0, 500));
          console.log('Total resume text length:', resumeText.length);

          // Verify the text is not empty
          if (!resumeText.trim()) {
            console.error('Resume text is empty or contains only whitespace');
          }
        }
      } catch (error) {
        console.error('Error reading resume file:', error);
        console.warn(`Resume file not found for resumeId=${resumeId}`, error);
      }
    }

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName: participantIdentity,
      participantToken,
      resumeId,
      resumeText,
      resumeUrl,
    };

    // Log the final data being sent (excluding the full resume text for brevity)
    console.log('Sending connection details:', {
      ...data,
      resumeText: data.resumeText ? `${data.resumeText.substring(0, 100)}...` : undefined,
      resumeUrl: data.resumeUrl
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error in connection-details:", error);
    return new NextResponse((error as Error).message, { status: 500 });
  }
}

function createParticipantToken(userInfo: AccessTokenOptions, roomName: string) {
  const at = new AccessToken(API_KEY!, API_SECRET!, {
    ...userInfo,
    ttl: "15m",
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };

  at.addGrant(grant);
  return at.toJwt();
}
