import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const { transcript } = await request.json();
        if (!transcript || !Array.isArray(transcript)) {
            return NextResponse.json(
                { error: 'Invalid transcript format' },
                { status: 400 }
            );
        }

        const prompt = `
        Analyze this interview transcript and provide a detailed assessment. The transcript is an array of messages, where each message is a string.

        Transcript:
        ${transcript
                .filter(m => m.text && m.final)
                .map(m => `${m.role.toUpperCase()}: ${m.text}`)
                .join('\n')}

            Strictly respond with a JSON object using this format:
        {
        "score": number (0-100),
        "strengths": string[],
        "improvements": string[],
        "feedback": string,
        "recommendations": string[]
        }

        ⚠️ Do not include any explanations or text outside the JSON block.

        Guidelines for scoring and feedback:
        1. Score should reflect overall performance (0-100)
        2. List 3-5 key strengths
        3. List 3-5 areas for improvement
        4. Provide detailed feedback about communication, technical knowledge, and problem-solving abilities
        5. Give 3-5 specific recommendations for improvement
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an expert interview analyst. Provide detailed, constructive feedback based on the interview transcript."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });

        console.log(completion.choices[0].message.content);

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('Error analyzing interview:', error);
        return NextResponse.json(
            { error: 'Failed to analyze interview' },
            { status: 500 }
        );
    }
} 