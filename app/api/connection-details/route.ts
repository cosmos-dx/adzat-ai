import { AccessToken, AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
  resumeId?: string;
  resumeText?: string;
};

export async function GET(req: Request) {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error("Missing LiveKit environment variables");
    }

    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get("resumeId") ?? undefined;

    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
    const participantToken = await createParticipantToken(
      { identity: participantIdentity },
      roomName
    );

    let resumeText: string | undefined = undefined;
    if (resumeId) {
      try {
        const filePath = path.join("/tmp", `resume-${resumeId}.txt`);
        resumeText = await readFile(filePath, "utf-8");
      } catch {
        console.warn(`Resume file not found for resumeId=${resumeId}`);
      }
    }

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName: participantIdentity,
      participantToken,
      resumeId,
      resumeText,
    };

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
