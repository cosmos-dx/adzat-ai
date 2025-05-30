'use client';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AnalysisResult {
    score: number;
    strengths: string[];
    improvements: string[];
    feedback: string;
    recommendations: string[];
}

export default function AnalysisPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

    useEffect(() => {
        const analyzeInterview = async () => {
            try {
                // Get transcript from localStorage
                const transcriptData = localStorage.getItem('interview_transcriptions');
                console.log('Retrieved transcript:', transcriptData); // Debug log

                if (!transcriptData) {
                    setError('No interview transcript found. Please complete an interview first.');
                    setIsLoading(false);
                    return;
                }

                const transcript = JSON.parse(transcriptData);
                console.log('Parsed transcript:', transcript); // Debug log

                if (!Array.isArray(transcript) || transcript.length === 0) {
                    setError('Invalid transcript format. Please try the interview again.');
                    setIsLoading(false);
                    return;
                }

                // Send transcript to API for analysis
                console.log("transcript: ", transcript)
                const response = await fetch('/api/interview/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ transcript }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to analyze interview');
                }

                const result = await response.json();
                console.log('Analysis result:', result); // Debug log
                setAnalysis(result);
                setIsLoading(false);

                // Clear transcript from localStorage after successful analysis
                localStorage.removeItem('interviewTranscript');
            } catch (err) {
                console.error('Error analyzing interview:', err);
                setError(err instanceof Error ? err.message : 'Failed to analyze interview');
                setIsLoading(false);
            }
        };

        analyzeInterview();
    }, []);

    const downloadReport = () => {
        if (!analysis) return;

        const report = `
Interview Analysis Report

Overall Score: ${analysis.score}/100

Key Strengths:
${analysis.strengths.map(s => `- ${s}`).join('\n')}

Areas for Improvement:
${analysis.improvements.map(i => `- ${i}`).join('\n')}

Detailed Feedback:
${analysis.feedback}

Recommendations:
${analysis.recommendations.map(r => `- ${r}`).join('\n')}
        `;

        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'interview-analysis.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-lg">Analyzing your interview...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="p-6 max-w-md w-full">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Analysis Error</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Button
                        onClick={() => router.push('/interview/setup')}
                        className="w-full"
                    >
                        Start New Interview
                    </Button>
                </Card>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="p-6 max-w-md w-full">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">No Analysis Available</h2>
                    <p className="text-gray-600 mb-4">Please complete an interview to see your analysis.</p>
                    <Button
                        onClick={() => router.push('/interview/setup')}
                        className="w-full"
                    >
                        Start New Interview
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold text-center text-black">
                        Interview Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {isLoading && (
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-lg">Analyzing your interview...</p>
                            </div>
                        )}
                        {/* Overall Score */}
                        <div className="text-center">
                            <h3 className="text-2xl font-semibold mb-2 text-black/80">Overall Score</h3>
                            <div className="text-4xl font-bold text-black/80">
                                {analysis.score}/100
                            </div>
                        </div>

                        {/* Key Strengths */}
                        <div>
                            <h3 className="text-xl font-semibold mb-3 text-black/80">Key Strengths</h3>
                            <ul className="list-disc list-inside space-y-2">
                                {analysis.strengths.map((strength, index) => (
                                    <li key={index} className="text-gray-700">{strength}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Areas for Improvement */}
                        <div>
                            <h3 className="text-xl font-semibold mb-3 text-black/80">Areas for Improvement</h3>
                            <ul className="list-disc list-inside space-y-2">
                                {analysis.improvements.map((improvement, index) => (
                                    <li key={index} className="text-gray-700">{improvement}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Detailed Feedback */}
                        <div>
                            <h3 className="text-xl font-semibold mb-3 text-black/80">Detailed Feedback</h3>
                            <p className="text-gray-700 whitespace-pre-line">{analysis.feedback}</p>
                        </div>

                        {/* Recommendations */}
                        <div>
                            <h3 className="text-xl font-semibold mb-3 text-black/80">Recommendations</h3>
                            <ul className="list-disc list-inside space-y-2">
                                {analysis.recommendations.map((recommendation, index) => (
                                    <li key={index} className="text-gray-700">{recommendation}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-center gap-4 mt-8 text-black/80">
                            <Button
                                onClick={downloadReport}
                                variant="outline"
                            >
                                Download Report
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => router.push('/interview/setup')}
                            >
                                Start New Interview
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 