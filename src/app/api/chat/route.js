function getApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) {
    keys.push(...process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()));
  }
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k.trim());
  }
  if (process.env.GEMINI_API_KEY) {
    keys.push(...process.env.GEMINI_API_KEY.split(',').map(k => k.trim()));
  }
  return Array.from(new Set(keys)).filter(k => k && k !== 'your_gemini_api_key_here');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, modelId, systemPrompt, userId, isPremium } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'API Key belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di .env.local' },
        { status: 401 }
      );
    }

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
      targetModel = 'gemini-2.0-flash';
    } else if (modelId === 'met-ai-2.5') {
      targetModel = 'gemini-flash-latest';
    }

    const activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    let result = null;
    let lastKeyError = null;

    // Try each API Key until one succeeds
    for (const apiKey of apiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: targetModel,
          systemInstruction: activeSystemPrompt,
        });
        const chat = model.startChat({
          history,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
            topP: 0.9,
          },
        });

        result = await chat.sendMessageStream(lastMessage.content);
        break; // Key worked! Break loop
      } catch (keyError) {
        console.warn(`API Key (${apiKey.slice(0, 8)}...) failed/limit, rotating to next key:`, keyError?.message || keyError);
        lastKeyError = keyError;

        // Try model fallbacks for this key
        const fallbacks = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro-latest'];
        for (const fbModelName of fallbacks) {
          if (fbModelName === targetModel) continue;
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const fallbackModel = genAI.getGenerativeModel({
              model: fbModelName,
              systemInstruction: activeSystemPrompt,
            });
            const fallbackChat = fallbackModel.startChat({ history });
            result = await fallbackChat.sendMessageStream(lastMessage.content);
            if (result) break;
          } catch (e) {
            // Keep trying next fallback model or next API key
          }
        }
        if (result) break;
      }
    }

    if (!result && lastKeyError) {
      throw lastKeyError;
    }

    const stream = new ReadableStream({
      async start(controller) {
        let hasStreamed = false;
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              hasStreamed = true;
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          controller.close();
        } catch (error) {
          console.warn('Stream iteration warning:', error?.message || error);

          if (!hasStreamed) {
            // Try fallback models if stream failed before sending any text
            const fallbacks = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro-latest'];
            let fbSuccess = false;
            for (const fbApiKey of apiKeys) {
              const fbGenAI = new GoogleGenerativeAI(fbApiKey);
              for (const fbModelName of fallbacks) {
                try {
                  const fbModel = fbGenAI.getGenerativeModel({
                    model: fbModelName,
                    systemInstruction: activeSystemPrompt,
                  });
                  const fbChat = fbModel.startChat({ history });
                  const fbRes = await fbChat.sendMessageStream(lastMessage.content);
                  for await (const chunk of fbRes.stream) {
                    const text = chunk.text();
                    if (text) {
                      hasStreamed = true;
                      controller.enqueue(new TextEncoder().encode(text));
                    }
                  }
                  fbSuccess = true;
                  break;
                } catch (fbErr) {
                  console.warn(`Fallback ${fbModelName} iter warning:`, fbErr?.message || fbErr);
                }
              }
              if (fbSuccess) break;
            }
            if (fbSuccess) {
              controller.close();
              return;
            }
          }

          if (!hasStreamed) {
            const fallbackMsg = "Halo! Saya MetSchool AI. Mohon maaf, server AI Google sedang padat. Silakan kirim ulang pesan kamu ya! ✨";
            controller.enqueue(new TextEncoder().encode(fallbackMsg));
          }
          controller.close();
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
      const quotaResponseText = `Halo Natan! 👋 Kuota harian API Key Google Gemini (20 request/hari di Google AI Studio) sedang mencapai batas maksimal dari Google.

💡 **Tips untuk Developer:**
Kamu bisa mengambil API Key baru gratis 100% dalam 10 detik di [Google AI Studio (aistudio.google.com)](https://aistudio.google.com), lalu perbarui \`GEMINI_API_KEY\` di \`.env.local\` dan Vercel agar kuota kembali fresh! ✨`;

      const quotaStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(quotaResponseText));
          controller.close();
        },
      });

      return new Response(quotaStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
        },
      });
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
