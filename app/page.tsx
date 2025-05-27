"use client";

import { useCallback, useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import {
  RoomContext,
  useVoiceAssistant,
  VoiceAssistantControlBar,
  RoomAudioRenderer,
  type AgentState,
  useLocalParticipant,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

import { NoAgentNotification } from "@/components/NoAgentNotification";
import TranscriptionView from "@/components/TranscriptionView";
import { CandidateVideoFeed } from "@/components/CandidateVideoFeed";
import type { ConnectionDetails } from "./api/connection-details/route";
import "./voiceOverrides.css";

export default function Page() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [room] = useState(() => new Room());

  const onConnectButtonClicked = useCallback(async () => {
    try {
      const url = new URL(
        process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
        window.location.origin
      );
      if (resumeId) {
        url.searchParams.set("resumeId", resumeId);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch connection details");
      }

      const connectionDetailsData: ConnectionDetails = await response.json();

      await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      console.error("Connection error:", error);
      alert("Failed to connect to the interview room.");
    }
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
    <div className="flex items-center justify-center flex-grow w-full">
      <RoomContext.Provider value={room}>
        <div className="lk-room-container max-w-[1024px] w-full mx-auto flex flex-col">
          <SimpleVoiceAssistant onConnectButtonClicked={onConnectButtonClicked} setResumeId={setResumeId} />
        </div>
      </RoomContext.Provider>
    </div>
  );
}

function CustomBarVisualizer({ agentState }: Readonly<{ agentState: AgentState | undefined }>) {
  const getStatusText = () => {
    switch (agentState) {
      case 'speaking':
        return 'AI is speaking';
      case 'listening':
        return 'AI is listening';
      case 'thinking':
        return 'AI is thinking';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Interview in progress';
    }
  };
  
  const getBarClassName = () => {
    switch (agentState) {
      case 'speaking':
        return 'bg-indigo-600'; 
      case 'listening':
        return 'bg-green-500'; 
      case 'thinking':
        return 'bg-amber-500'; 
      default:
        return 'bg-gray-400'; 
    }
  };
  
  const isActive = agentState === 'speaking' || agentState === 'listening' || agentState === 'thinking';
  
  return (
    <div className="rounded-lg overflow-hidden w-[256px] h-[256px] bg-white shadow-lg flex flex-col">
      <div className="text-indigo-600 font-bold py-2 text-center border-b border-gray-100">
        AI Interviewer
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="flex items-end justify-center space-x-1 h-[128px] w-full">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((barId) => (
            <div 
              key={`visualizer-bar-${barId}`}
              className={`${getBarClassName()} w-3 rounded-t-md ${isActive ? 'visualizer-bar' : 'h-4'}`}
              style={{
                height: isActive ? `${20 + Math.random() * 80}%` : '10%', 
                animationDelay: `${barId * 0.1}s`,
                opacity: isActive ? 1 : 0.5
              }}
            />
          ))}
        </div>
      </div>
      <div className="text-gray-600 text-sm text-center py-2 border-t border-gray-100">
        {getStatusText()}
      </div>
    </div>
  );
}

function SimpleVoiceAssistant({
  onConnectButtonClicked,
  setResumeId,
}: Readonly<{
  onConnectButtonClicked: () => void;
  setResumeId: (id: string) => void;
}>) {
  const { state: agentStateRaw } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);

  const agentState = agentStateRaw as AgentState | undefined;

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleMicToggle = useCallback(async () => {
    if (localParticipant) {
      try {
        const newMuteState = !isMuted;
        await localParticipant.setMicrophoneEnabled(!newMuteState);
        setIsMuted(newMuteState);
        console.log(`Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
      } catch (error) {
        console.error('Error toggling microphone:', error);
      }
    }
  }, [localParticipant, isMuted]);

  const handleDisconnect = () => {
    window.location.reload();
  };

  useEffect(() => {
    if (localParticipant && agentState !== 'disconnected') {
      const isMicEnabled = localParticipant.isMicrophoneEnabled;
      setIsMuted(!isMicEnabled);
    }
  }, [localParticipant, agentState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
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
    <AnimatePresence mode="wait">
      {agentState === "disconnected" ? (
        <motion.div
          key="disconnected"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center h-full w-full"
        >
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <div className="flex justify-center mb-6">
              <div className="text-indigo-600 text-3xl font-bold">Adzat.io Interview</div>
            </div>
            
            <div className="flex flex-col items-center gap-6 mb-6">
              <div className="w-full">
                <p className="text-gray-600 mb-2 text-center">Upload your resume to begin</p>
                <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-indigo-500 transition-all">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-gray-500">
                    {resumeFile ? resumeFile.name : "Choose File"}
                  </span>
                </label>
              </div>
              
              <button
                onClick={handleUpload}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Upload Resume
              </button>
              
              {uploadStatus && (
                <p className={`text-sm ${uploadStatus.includes("success") ? "text-green-600" : "text-yellow-600"}`}>
                  {uploadStatus}
                </p>
              )}
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <button
                className="w-full py-2 px-4 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium transition-colors"
                onClick={onConnectButtonClicked}
                disabled={!resumeFile}
                title={!resumeFile ? "Please upload a resume first" : ""}
              >
                Start Interview
              </button>
            </div>
            
            <div className="mt-6 text-center text-xs text-gray-500">
              By continuing, you agree to our Terms of Service
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="connected"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4 h-full flex-1 relative pb-16 w-full"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 w-full mb-4 max-w-[540px] mx-auto">
            <CustomBarVisualizer agentState={agentState} />
            <CandidateVideoFeed />
          </div>
          <div className="flex-1 w-full max-w-[540px] mx-auto relative">
            <TranscriptionView />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button 
                className={`${
                  isMuted 
                    ? 'bg-gray-600 hover:bg-gray-700' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white rounded-full p-2.5 transition-colors flex items-center justify-center`}
                onClick={handleMicToggle}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? (
                  <FaMicrophoneSlash size={20} />
                ) : (
                  <FaMicrophone size={20} />
                )}
              </button>
              <button 
                className="bg-red-500 hover:bg-red-600 text-white font-medium rounded-full px-4 py-2 text-sm transition-colors flex items-center"
                onClick={handleDisconnect}
                aria-label="Disconnect call"
              >
                Disconnect
              </button>
            </div>
          </div>
          <div className="hidden">
            <VoiceAssistantControlBar />
          </div>
          <RoomAudioRenderer />
          <NoAgentNotification state={agentState ?? "disconnected"} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
