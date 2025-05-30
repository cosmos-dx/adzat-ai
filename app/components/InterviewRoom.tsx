import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind, Track, LocalTrack } from 'livekit-client';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { toast } from 'sonner';

interface InterviewRoomProps {
    roomName: string;
    token: string;
    candidateName: string;
    resumeText: string;
    questions: string[];
}

export default function InterviewRoom({ roomName, token, candidateName, resumeText, questions }: InterviewRoomProps) {
    const router = useRouter();
    const [room, setRoom] = useState<Room | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [transcript, setTranscript] = useState<string[]>([]);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let currentRoom: Room | null = null;

        const connectToRoom = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Request media permissions first
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                // Create and connect to room
                currentRoom = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                    publishDefaults: {
                        simulcast: true,
                    },
                });

                // Set up event handlers
                currentRoom
                    .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
                    .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
                    .on(RoomEvent.Disconnected, handleDisconnected)
                    .on(RoomEvent.DataReceived, handleDataReceived);

                // Connect to the room
                await currentRoom.connect('wss://adzat-ai.livekit.cloud', token, {
                    autoSubscribe: true,
                });

                // Attach local tracks
                const localParticipant = currentRoom.localParticipant;
                if (localParticipant) {
                    await localParticipant.publishTrack(stream.getVideoTracks()[0]);
                    await localParticipant.publishTrack(stream.getAudioTracks()[0]);
                }

                setRoom(currentRoom);
                setIsConnected(true);
                setIsLoading(false);

                // Send initial data to the agent
                const initialData = {
                    type: 'start_interview',
                    candidateName,
                    resumeText,
                    questions,
                };
                currentRoom.localParticipant.publishData(
                    new TextEncoder().encode(JSON.stringify(initialData)),
                    { reliable: true }
                );

            } catch (err) {
                console.error('Error connecting to room:', err);
                setError(err instanceof Error ? err.message : 'Failed to connect to interview room');
                setIsLoading(false);
                toast.error('Failed to connect to interview room');
            }
        };

        connectToRoom();

        return () => {
            if (currentRoom) {
                currentRoom.disconnect();
            }
        };
    }, [roomName, token, candidateName, resumeText, questions]);

    const handleParticipantConnected = (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
        toast.success('Interviewer joined the room');
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        toast.info('Interviewer left the room');
    };

    const handleDisconnected = () => {
        console.log('Disconnected from room');
        setIsConnected(false);
        toast.info('Disconnected from interview room');
    };

    const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            console.log('Received data:', data);

            if (data.type === 'transcript') {
                setTranscript(prev => [...prev, data.text]);
            } else if (data.type === 'interview_complete') {
                // Store transcript in localStorage before redirecting
                localStorage.setItem('interviewTranscript', JSON.stringify(transcript));
                toast.success('Interview completed!');
                router.push('/interview/analysis');
            }
        } catch (err) {
            console.error('Error processing received data:', err);
        }
    };

    const toggleMute = async () => {
        if (room) {
            const audioTrack = room.localParticipant.getTrackPublications().find(
                pub => pub.kind === 'audio'
            );
            if (audioTrack?.track) {
                const localTrack = audioTrack.track as LocalTrack;
                if (isMuted) {
                    await localTrack.unmute();
                } else {
                    await localTrack.mute();
                }
                setIsMuted(!isMuted);
            }
        }
    };

    const toggleVideo = async () => {
        if (room) {
            const videoTrack = room.localParticipant.getTrackPublications().find(
                pub => pub.kind === 'video'
            );
            if (videoTrack?.track) {
                const localTrack = videoTrack.track as LocalTrack;
                if (isVideoOff) {
                    await localTrack.unmute();
                } else {
                    await localTrack.mute();
                }
                setIsVideoOff(!isVideoOff);
            }
        }
    };

    const endInterview = async () => {
        if (room) {
            try {
                // Store transcript in localStorage before disconnecting
                localStorage.setItem('interviewTranscript', JSON.stringify(transcript));
                console.log('Stored transcript:', transcript); // Debug log

                // Send end interview signal
                const endData = {
                    type: 'end_interview',
                    candidateName,
                };
                await room.localParticipant.publishData(
                    new TextEncoder().encode(JSON.stringify(endData)),
                    { reliable: true }
                );

                // Disconnect from room
                await room.disconnect();
                setRoom(null);

                // Show success message
                toast.success('Interview ended. Redirecting to analysis...');

                // Use setTimeout to ensure localStorage is set before redirect
                setTimeout(() => {
                    router.push('/interview/analysis');
                }, 100);
            } catch (error) {
                console.error('Error ending interview:', error);
                toast.error('Failed to end interview properly');
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-lg">Connecting to interview room...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="p-6 max-w-md w-full">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Button
                        onClick={() => router.push('/interview/setup')}
                        className="w-full"
                    >
                        Return to Setup
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Local Video */}
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4 flex gap-2">
                        <Button
                            onClick={toggleMute}
                            variant={isMuted ? "destructive" : "secondary"}
                            size="icon"
                        >
                            {isMuted ? 'Unmute' : 'Mute'}
                        </Button>
                        <Button
                            onClick={toggleVideo}
                            variant={isVideoOff ? "destructive" : "secondary"}
                            size="icon"
                        >
                            {isVideoOff ? 'Start Video' : 'Stop Video'}
                        </Button>
                    </div>
                </div>

                {/* Remote Video */}
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>

            {/* Controls */}
            <div className="mt-4 flex justify-center gap-4">
                <Button
                    onClick={endInterview}
                    variant="destructive"
                >
                    End Interview
                </Button>
            </div>
        </div>
    );
} 