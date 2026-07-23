function getGroqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const line = content.split(/\r?\n/).find(l => l.trim().startsWith('GROQ_API_KEY='));
      if (line) return line.split('=')[1].trim();
    }
  } catch {}
  return null;
}

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

  // Fallback read from file if process.env isn't updated
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const line = content.split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
      if (line) {
        const raw = line.split('=')[1].trim();
        keys.push(...raw.split(',').map(k => k.trim()));
      }
    }
  } catch {}

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

    // 1. Try Groq API if available (14,400 free requests/day)
    const groqKey = getGroqKey();
    if (groqKey) {
      try {
        const formattedMsgs = [
          { role: 'system', content: activeSystemPrompt },
          ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : (m.role || 'user'), content: m.content }))
        ];
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: formattedMsgs,
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });
        if (groqRes.ok) {
          const groqJson = await groqRes.json();
          const groqText = groqJson.choices?.[0]?.message?.content;
          if (groqText) {
            const groqStream = new ReadableStream({
              async start(controller) {
                controller.enqueue(new TextEncoder().encode(groqText));
                controller.close();
              },
            });
            return new Response(groqStream, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
              },
            });
          }
        }
      } catch (groqErr) {
        console.warn('Groq API warning, falling back to Gemini:', groqErr?.message || groqErr);
      }
    }

    // 2. Try Gemini API Keys Pool
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

    if (!result) {
      // Try Groq API if available (14,400 free requests/day)
      const groqKey = getGroqKey();
      if (groqKey) {
        try {
          const formattedMsgs = [
            { role: 'system', content: activeSystemPrompt },
            ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : (m.role || 'user'), content: m.content }))
          ];
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: formattedMsgs,
              temperature: 0.7,
              max_tokens: 4096,
            }),
          });
          if (groqRes.ok) {
            const groqJson = await groqRes.json();
            const groqText = groqJson.choices?.[0]?.message?.content;
            if (groqText) {
              const groqStream = new ReadableStream({
                async start(controller) {
                  controller.enqueue(new TextEncoder().encode(groqText));
                  controller.close();
                },
              });
              return new Response(groqStream, {
                headers: {
                  'Content-Type': 'text/plain; charset=utf-8',
                  'Transfer-Encoding': 'chunked',
                  'Cache-Control': 'no-cache',
                },
              });
            }
          }
        } catch (groqErr) {
          console.warn('Groq API fallback warning:', groqErr?.message || groqErr);
        }
      }

      // Try OpenRouter API if available (Free DeepSeek & Llama 3)
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (openRouterKey) {
        try {
          const formattedMsgs = [
            { role: 'system', content: activeSystemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content }))
          ];
          const routerRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-3.3-70b-instruct:free',
              messages: formattedMsgs,
            }),
          });
          if (routerRes.ok) {
            const routerJson = await routerRes.json();
            const routerText = routerJson.choices?.[0]?.message?.content;
            if (routerText) {
              const routerStream = new ReadableStream({
                async start(controller) {
                  controller.enqueue(new TextEncoder().encode(routerText));
                  controller.close();
                },
              });
              return new Response(routerStream, {
                headers: {
                  'Content-Type': 'text/plain; charset=utf-8',
                  'Transfer-Encoding': 'chunked',
                  'Cache-Control': 'no-cache',
                },
              });
            }
          }
        } catch (routerErr) {
          console.warn('OpenRouter API fallback warning:', routerErr?.message || routerErr);
        }
      }

      const quotaResponseText = `Halo! 👋 Kuota harian API Key Google Gemini (20 request/hari di Google AI Studio) sedang mencapai batas maksimal dari Google.

💡 **Tips untuk Developer:**
Kamu bisa mengambil API Key baru gratis 100% dalam 10 detik di [Google AI Studio (aistudio.google.com)](https://aistudio.google.com), atau tambahkan \`GROQ_API_KEY\` (14.400 request/hari gratis di [groq.com](https://groq.com)) di \`.env.local\` agar kuota kembali fresh! ✨`;

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
    const fallbackText = "Halo! Server AI sedang padat sementara. Silakan coba kirim ulang pesan kamu beberapa saat lagi ya! ✨";
    const fallbackStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(fallbackText));
        controller.close();
      },
    });

    return new Response(fallbackStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
