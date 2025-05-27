import useCombinedTranscriptions from "@/hooks/useCombinedTranscriptions";
import * as React from "react";

export default function TranscriptionView() {
  const combinedTranscriptions = useCombinedTranscriptions();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [combinedTranscriptions]);

  return (
    <div className="relative h-[200px] w-full max-w-[540px] mx-auto bg-white rounded-lg shadow-md p-1">
      <h3 className="text-indigo-600 font-medium text-center py-2 border-b border-gray-100">
        Conversation
      </h3>

      <div className="absolute top-9 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

      <div ref={containerRef} className="h-[calc(100%-40px)] flex flex-col gap-2 overflow-y-auto px-4 py-8">
        {combinedTranscriptions.length === 0 ? (
          <div className="text-gray-400 text-center italic">
            The conversation will appear here...
          </div>
        ) : (
          combinedTranscriptions.map((segment) => (
            <div
              id={segment.id}
              key={segment.id}
              className={
                segment.role === "assistant"
                  ? "p-2 pl-3 bg-indigo-50 rounded-lg self-start max-w-[80%] text-indigo-900"
                  : "bg-gray-100 rounded-lg p-2 pr-3 self-end max-w-[80%] text-gray-800"
              }
            >
              {segment.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
