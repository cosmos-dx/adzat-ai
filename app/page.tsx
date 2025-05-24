"use client";

import { useCallback, useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import {
  RoomContext,
  useVoiceAssistant,
  VoiceAssistantControlBar,
  RoomAudioRenderer,
  type AgentState,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";

import { NoAgentNotification } from "@/components/NoAgentNotification";
import TranscriptionView from "@/components/TranscriptionView";
import { CandidateVideoFeed } from "@/components/CandidateVideoFeed"; 
import type { ConnectionDetails } from "./api/connection-details/route";
import "./voiceOverrides.css";

export default function Page() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [room] = useState(() => new Room());

  const onConnectButtonClicked = useCallback(async () => {
    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
      window.location.origin
    );
    if (resumeId) {
      url.searchParams.set("resumeId", resumeId);
    }

    const response = await fetch(url.toString());
    const connectionDetailsData: ConnectionDetails = await response.json();

    await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);
    await room.localParticipant.setMicrophoneEnabled(true);
  }, [room, resumeId]);

  useEffect(() => {
    const onDeviceFailure = (e: any) => {
      console.error("Device error:", e);
    };

    room.on(RoomEvent.MediaDevicesError, onDeviceFailure);
    return () => {
      room.off(RoomEvent.MediaDevicesError, onDeviceFailure);
    };
  }, [room]);

  return (
    <main
      data-lk-theme="default"
      className="min-h-screen flex items-center justify-center bg-[#0e0e0e] text-white px-4"
    >
      <RoomContext.Provider value={room}>
        <div className="lk-room-container max-w-[1024px] w-[90vw] mx-auto max-h-[90vh] flex flex-col">
          <SimpleVoiceAssistant onConnectButtonClicked={onConnectButtonClicked} setResumeId={setResumeId} />
        </div>
      </RoomContext.Provider>
    </main>
  );
}

function SimpleVoiceAssistant({
  onConnectButtonClicked,
  setResumeId,
}: {
  onConnectButtonClicked: () => void;
  setResumeId: (id: string) => void;
}) {
  const { state: agentStateRaw } = useVoiceAssistant();

  const agentState = agentStateRaw as AgentState | undefined;

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
      setUploadStatus("");
    }
  };

  const handleUpload = async () => {
    if (!resumeFile) {
      setUploadStatus("Please select a resume file first.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", resumeFile);

    try {
      const res = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (res.ok && result.resumeId) {
        setUploadStatus("Resume uploaded successfully.");
        setResumeId(result.resumeId);
      } else {
        setUploadStatus("Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("Error uploading resume.");
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {agentState === "disconnected" ? (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="grid items-center justify-center h-full gap-6"
          >
            <div className="flex flex-col items-center  gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="text-black bg-white rounded-md hover:cursor-pointer px-2 py-1"
              />
              <button onClick={handleUpload} className="uppercase px-4 py-2 bg-green-500 hover:cursor-pointer text-white rounded-md">
                Upload Resume
              </button>
              {uploadStatus && <p className="text-sm text-yellow-400">{uploadStatus}</p>}
            </div>

            <button className="uppercase px-4 py-2 bg-white text-black rounded-md hover:cursor-pointer" onClick={onConnectButtonClicked}>
              Start Interview
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-4 h-full flex-1"
          >
           

            <div className="flex items-center justify-evenly gap-2 w-full flex-1">
              <img
                src="/ai-image.png"
                alt="AI Assistant"
                className="w-[256px] h-[256px] rounded-full shadow-lg"
              />
              <CandidateVideoFeed />
            </div>
            <div className="flex-1 w-full">
              <TranscriptionView />
            </div>
            <div className="w-full">
              <VoiceAssistantControlBar />
            </div>
            <RoomAudioRenderer />
            <NoAgentNotification state={agentState ?? "disconnected"} />

           
          </motion.div>
          
        )}
        
      </AnimatePresence>
       
    </>
  );
}