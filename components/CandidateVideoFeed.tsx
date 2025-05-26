import { useEffect, useRef } from "react";

export function CandidateVideoFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access webcam", err);
        alert("Unable to access your camera. Please grant permissions and refresh.");
      }
    };

    startCamera();
    return () => {
      console.log("Cleaning up video stream");
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      }
    }
  }, []);

  return (
    <div className="rounded-lg overflow-hidden w-[256px] h-[256px] bg-white shadow-lg flex flex-col">
      <div className="text-indigo-600 font-bold py-2 text-center border-b border-gray-100">
        You
      </div>
      <div className="flex-1 bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
