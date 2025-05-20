import { useEffect, useRef } from "react";

export function CandidateVideoFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access webcam", err);
        alert("Unable to access your camera. Please grant permissions and refresh.");
      }
    };

    startCamera();
  }, []);

  return (
    <div className="rounded-xl overflow-hidden w-[256px] h-[256px] bg-black shadow-lg">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
    </div>
  );
}
