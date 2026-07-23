import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const TOOL_PROMPTS = {
  summarize: (text, lang) => `Tolong ringkas teks berikut dengan poin-poin penting yang jelas dan terstruktur. Gunakan bahasa ${lang || 'Indonesia'}. Format dengan bullet points dan header jika diperlukan:\n\n${text}`,
  translate: (text, targetLang) => `Terjemahkan teks berikut ke dalam bahasa ${targetLang}. Berikan terjemahan yang natural, bukan kata per kata. Jika ada istilah teknis, pertahankan dalam bahasa aslinya:\n\n${text}`,
  code: (code, instruction) => `${instruction || 'Analisis kode berikut'}: Jelaskan apa yang dilakukan kode ini, identifikasi potensi bug atau masalah, dan berikan saran perbaikan jika ada.\n\n\`\`\`\n${code}\n\`\`\``,
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { tool, input, targetLang, instruction } = body;

    if (!tool || !input) {
      return NextResponse.json({ error: 'Missing tool or input' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'API Key belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di .env.local' },
        { status: 401 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    let prompt = '';
    if (tool === 'summarize') prompt = TOOL_PROMPTS.summarize(input, 'Indonesia');
    else if (tool === 'translate') prompt = TOOL_PROMPTS.translate(input, targetLang || 'Inggris');
    else if (tool === 'code') prompt = TOOL_PROMPTS.code(input, instruction);
    else return NextResponse.json({ error: 'Unknown tool' }, { status: 400 });

    const result = await model.generateContentStream(prompt);

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
    console.error('Tools API error:', error);
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('retry')) {
      return NextResponse.json(
        { error: 'Batas kuota gratis Gemini tercapai sementara. Mohon tunggu ~30 detik.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
