'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { MODELS, DEFAULT_SYSTEM_PROMPT } from '@/lib/models';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useSidebar } from '@/lib/SidebarContext';
import styles from './chat.module.css';

function ModelSelector({ selectedModel, onSelect, isPremium }) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  return (
    <div className={styles.modelSelectorWrap}>
      <button
        className={styles.modelSelector}
        onClick={() => setOpen(!open)}
        id="model-selector-btn"
      >
        <span>{current.icon}</span>
        <span className={styles.modelName}>{current.name}</span>
        <span className={`badge ${current.badgeClass}`}>{current.badge}</span>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.modelDropdown}>
          {MODELS.map((model) => {
            const locked = model.tier === 'premium' && !isPremium;
            return (
              <button
                key={model.id}
                className={`${styles.modelOption} ${selectedModel === model.id ? styles.modelOptionActive : ''} ${locked ? styles.modelOptionLocked : ''}`}
                onClick={() => {
                  if (!locked) {
                    onSelect(model.id);
                    setOpen(false);
                  }
                }}
              >
                <span className={styles.modelOptionIcon}>{model.icon}</span>
                <div className={styles.modelOptionInfo}>
                  <span className={styles.modelOptionName}>{model.name}</span>
                  <span className={styles.modelOptionDesc}>{model.description}</span>
                </div>
                <span className={`badge ${model.badgeClass}`}>{model.badge}</span>
                {locked && <span className={styles.lockIcon}>🔒</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Message({ message, isLast }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAi} animate-fade-in`}>
      {!isUser && (
        <img src="/logo.png" alt="MetSchool AI" style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} />
      )}
      <div className={`${styles.messageBubble} ${isUser ? styles.bubbleUser : styles.bubbleAi}`}>
        {isUser ? (
          <p className={styles.userText}>{message.content}</p>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeContent = String(children).replace(/\n$/, '');
                  if (!inline && match) {
                    return (
                      <div className={styles.codeBlock}>
                        <div className={styles.codeBlockHeader}>
                          <span className={styles.codeLang}>{match[1]}</span>
                          <button
                            className={styles.copyCodeBtn}
                            onClick={() => {
                              navigator.clipboard.writeText(codeContent);
                            }}
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', background: '#1a1a2e' }}
                          {...props}
                        >
                          {codeContent}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {!isUser && message.content && (
          <div className={styles.messageActions}>
            <button className={styles.actionBtn} onClick={handleCopy}>
              {copied ? '✓ Copied' : '⊕ Copy'}
            </button>
          </div>
        )}

        {message.streaming && (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}
      </div>
      {isUser && (
        <div className={styles.userAvatar}>
          You
        </div>
      )}
    </div>
  );
}

export default function ChatPage({ conversationId = null, initialMessages = [], initialModel = 'gemini-flash-latest' }) {
  const router = useRouter();
  const { user, userProfile, canSendMessage, getRemainingMessages, isPremium, setUserProfile } = useAuth();
  const { toggleMobileSidebar } = useSidebar();

  const [messages, setMessages] = useState(initialMessages.map((m, i) => ({ ...m, id: i })));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [convId, setConvId] = useState(conversationId);
  const convIdRef = useRef(conversationId);
  const prevConvIdProp = useRef(conversationId);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (prevConvIdProp.current !== conversationId) {
      const isInternalNavigation = convIdRef.current === conversationId && conversationId !== null;
      prevConvIdProp.current = conversationId;
      convIdRef.current = conversationId || null;
      setConvId(conversationId || null);

      if (!isInternalNavigation) {
        setMessages(initialMessages.map((m, i) => ({ ...m, id: i })));
        setSelectedModel(initialModel);
        setError('');
      }
    }
  }, [conversationId, initialMessages, initialModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!canSendMessage()) {
      setError('Kamu sudah mencapai batas pesan hari ini. Upgrade ke Premium untuk unlimited!');
      return;
    }

    setError('');
    const userMessage = { role: 'user', content: text, id: Date.now() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const aiMsgId = Date.now() + 1;

    try {
      setLoading(true);
      // Add streaming placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '', id: aiMsgId, streaming: true }]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          modelId: selectedModel,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          userId: user?.uid,
          isPremium: isPremium(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Gagal menghubungi AI');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMsgId
              ? { ...m, content: fullContent, streaming: true }
              : m
          )
        );
      }

      // Unlock UI immediately as soon as AI response finishes!
      setLoading(false);

      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: fullContent, streaming: false }
            : m
        )
      );

      // Asynchronously save to Firestore in background without blocking UI
      (async () => {
        try {
          const allMessages = [
            ...updatedMessages,
            { role: 'assistant', content: fullContent },
          ];

          let currentConvId = convIdRef.current;

          if (!currentConvId) {
            const title = text.slice(0, 60) || 'New Chat';
            const convRef = await addDoc(collection(db, 'conversations'), {
              userId: user.uid,
              title,
              model: selectedModel,
              messages: allMessages,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            convIdRef.current = convRef.id;
            setConvId(convRef.id);
            router.replace(`/app/chat/${convRef.id}`, { scroll: false });
          } else {
            await updateDoc(doc(db, 'conversations', currentConvId), {
              messages: allMessages,
              updatedAt: serverTimestamp(),
            });
          }

          // Update daily message count
          if (user && !isPremium()) {
            const userRef = doc(db, 'users', user.uid);
            const today = new Date().toDateString();
            if (userProfile?.dailyResetDate !== today) {
              await updateDoc(userRef, {
                dailyMessageCount: 1,
                dailyResetDate: today,
              });
            } else {
              await updateDoc(userRef, { dailyMessageCount: increment(1) });
            }
          }
        } catch (firestoreError) {
          console.warn('Firestore sync warning:', firestoreError?.message || firestoreError);
        }
      })();

    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
      setMessages(prev => prev.filter(m => m.id !== aiMsgId));
      setLoading(false);
    }
  }, [input, loading, messages, selectedModel, user, convId, canSendMessage, isPremium, userProfile, router]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const remaining = getRemainingMessages();
  const isNewChat = !convId && messages.length === 0;

  return (
    <div className={styles.chatPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.mobileMenuBtn}
            onClick={toggleMobileSidebar}
            title="Buka Menu"
            id="mobile-menu-toggle-btn"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <ModelSelector
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            isPremium={isPremium()}
          />
        </div>
        <div className={styles.headerRight}>
          {!isPremium() && (
            <span className={styles.remainingCount}>
              {remaining === Infinity ? '∞' : remaining} pesan tersisa
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {isNewChat && (
          <div className={styles.welcome}>
            <img
              src="/logo.png"
              alt="Metland School"
              style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))', marginBottom: 16 }}
            />
            <h1 className={`${styles.welcomeTitle} font-display`}>
              Halo! Aku <span className="gradient-text">MetSchool AI</span>
            </h1>
            <p className={styles.welcomeDesc}>
              Tanyakan apa saja — aku siap membantu dengan pertanyaan, kode, tulisan, analisis, dan banyak lagi.
            </p>
            <div className={styles.suggestions}>
              {[
                'Jelaskan konsep machine learning dengan sederhana',
                'Buatkan fungsi Python untuk sorting algoritma',
                'Bantu aku tulis email profesional',
                'Apa perbedaan React dan Vue?',
              ].map((s) => (
                <button
                  key={s}
                  className={styles.suggestionBtn}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={msg.id || i} message={msg} isLast={i === messages.length - 1} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className={styles.error}>
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <form
          className={styles.inputBox}
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <textarea
            ref={textareaRef}
            id="chat-input"
            className={styles.textarea}
            placeholder="Ketik pesan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            type="submit"
            id="send-btn"
            className={`${styles.sendBtn} ${loading || !input.trim() ? styles.sendBtnDisabled : ''}`}
          >
            {loading ? (
              <div className={styles.sendSpinner} />
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        <p className={styles.inputHint}>
          MetSchool AI bisa membuat kesalahan. Selalu verifikasi informasi penting.
        </p>
      </div>
    </div>
  );
}
