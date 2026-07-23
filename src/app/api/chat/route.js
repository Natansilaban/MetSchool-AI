import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, modelId, systemPrompt, userId, isPremium } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'API Key belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di .env.local' },
        { status: 401 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Model access control
    const premiumModels = ['met-pro-2.5', 'gemini-2.5-pro'];
    if (premiumModels.includes(modelId) && !isPremium) {
      return NextResponse.json(
        { error: 'Model ini hanya untuk pengguna Premium. Upgrade sekarang!' },
        { status: 403 }
      );
    }

    let targetModel = 'gemini-flash-latest';
    if (modelId === 'met-pro-2.5' || modelId === 'gemini-2.5-pro') {
      targetModel = 'gemini-pro-latest';
    } else if (modelId === 'met-ai-2.5') {
      targetModel = 'gemini-flash-latest';
    }

    const model = genAI.getGenerativeModel({
      model: targetModel,
      systemInstruction: systemPrompt,
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    let result;
    try {
      result = await chat.sendMessageStream(lastMessage.content);
    } catch (streamError) {
      if (streamError.status === 429 || streamError.message?.includes('quota') || streamError.message?.includes('retry')) {
        try {
          const fallbackModel = genAI.getGenerativeModel({
            model: 'gemini-pro-latest',
            systemInstruction: systemPrompt,
          });
          const fallbackChat = fallbackModel.startChat({ history });
          result = await fallbackChat.sendMessageStream(lastMessage.content);
        } catch (fallbackError) {
          throw fallbackError;
        }
      } else {
        throw streamError;
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    const msg = error.message || '';
    
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('API key')) {
      return NextResponse.json(
        { error: 'API Key Gemini belum valid. Pastikan menyalin key dari Google AI Studio.' },
        { status: 401 }
      );
    }

    if (error.status === 429 || msg.includes('quota') || msg.includes('retry') || msg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Batas kuota pesan gratis Gemini tercapai sementara. Silakan coba lagi dalam 30 detik.' },
        { status: 429 }
      );
    }

    if (msg.includes('404') || msg.includes('not found')) {
      return NextResponse.json(
        { error: 'Layanan AI sedang sibuk. Silakan coba kirim ulang pesan kamu.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kendala koneksi ke AI. Silakan coba lagi dalam beberapa saat.' },
      { status: 500 }
    );
  }
}
