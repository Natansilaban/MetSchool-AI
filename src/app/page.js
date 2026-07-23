'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import LoginModal from '@/components/LoginModal';
import styles from './page.module.css';

const GUEST_LIMIT = 5;
const GUEST_KEY = 'metschool_guest_count';

const SYSTEM_PROMPT = `Kamu adalah MetSchool AI, asisten belajar cerdas dan ramah yang membantu siapa saja memahami berbagai topik. Kamu sabar, informatif, dan menjelaskan dengan cara yang mudah dipahami. Jawab dalam bahasa yang sama dengan pertanyaan user (Indonesia atau Inggris). Gunakan markdown untuk formatting yang baik — bullet points, bold, code block, dll.`;

const SUGGESTIONS = [
  { icon: '💡', text: 'Jelaskan machine learning dengan contoh sederhana' },
  { icon: '✍️', text: 'Bantu aku tulis email profesional' },
  { icon: '💻', text: 'Buatkan fungsi Python untuk sorting data' },
  { icon: '📚', text: 'Apa perbedaan React dan Vue.js?' },
];

export default function HomePage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginReason, setLoginReason] = useState('limit'); // 'limit' | 'general'
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mainRef = useRef(null);

  // Load guest count + auth state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('reset=true')) {
      localStorage.removeItem(GUEST_KEY);
    }
    const count = parseInt(localStorage.getItem(GUEST_KEY) || '0');
    setGuestCount(count);

    // Lazy-load firebase auth
    const loadAuth = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const { onAuthStateChanged } = await import('firebase/auth');
        const unsub = onAuthStateChanged(auth, (u) => {
          setUser(u);
          setAuthReady(true);
        });
        return unsub;
      } catch {
        setAuthReady(true);
      }
    };
    const cleanup = loadAuth();
    return () => { cleanup.then(fn => fn && fn()); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = () => user || guestCount < GUEST_LIMIT;
  const remaining = user ? Infinity : Math.max(0, GUEST_LIMIT - guestCount);

  const openLogin = (reason = 'general') => {
    setLoginReason(reason);
    setShowLoginModal(true);
  };

  const sendMessage = useCallback(async (overrideInput) => {
    const text = (typeof overrideInput === 'string' ? overrideInput : input).trim();
    if (!text || loading) return;

    if (!canSend()) {
      openLogin('limit');
      return;
    }

    setError('');
    const userMsg = { role: 'user', content: text, id: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const aiId = Date.now() + 1;

    try {
      setLoading(true);

      // Track guest usage before sending
      let newCount = guestCount;
      if (!user) {
        newCount = guestCount + 1;
        setGuestCount(newCount);
        try {
          localStorage.setItem(GUEST_KEY, String(newCount));
        } catch {
          // ignore storage error
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '', id: aiId, streaming: true }]);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          modelId: 'gemini-flash-latest',
          systemPrompt: SYSTEM_PROMPT,
          userId: user?.uid || 'guest',
          isPremium: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghubungi AI');
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, content: full, streaming: true } : m)
        );
      }

      setMessages(prev =>
        prev.map(m => m.id === aiId ? { ...m, content: full, streaming: false } : m)
      );

      // Show login modal after last free message
      if (!user && newCount >= GUEST_LIMIT) {
        setTimeout(() => openLogin('limit'), 1200);
      }

    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
      setMessages(prev => prev.filter(m => m.id !== aiId));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, messages, user, guestCount]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className={styles.page}>
      {/* Liquid blobs background */}
      <div className={styles.bgBlobs} aria-hidden="true">
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      {/* Floating Glass Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <img src="/logo.png" alt="Metland School Logo" className={styles.logoImg} />
            <span className={styles.logoText}>
              MetSchool <span className={styles.logoAI}>AI</span>
            </span>
          </div>
          <div className={styles.headerRight}>
            {authReady && !user && (
              <div className={styles.headerActions}>
                <button
                  className={styles.btnMasuk}
                  onClick={() => openLogin('general')}
                  id="header-login-btn"
                >
                  Masuk
                </button>
                <button
                  className={styles.btnDaftar}
                  onClick={() => openLogin('general')}
                  id="header-signup-btn"
                >
                  Daftar Gratis
                </button>
              </div>
            )}
            {authReady && user && (
              <div className={styles.userChip}>
                {user.photoURL && (
                  <img src={user.photoURL} alt="" className={styles.userAvatar} />
                )}
                <span className={styles.userName}>{user.displayName?.split(' ')[0]}</span>
                <Link href="/app/chat" className={styles.appLink} id="open-app-link">
                  Buka App →
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main ref={mainRef} className={styles.main}>
        {/* Welcome Screen */}
        {!hasMessages && (
          <div className={styles.welcome}>
            <div className={styles.welcomeLogoWrap}>
              <img src="/logo.png" alt="Metland School" className={styles.welcomeLogoImg} />
            </div>
            <h1 className={styles.welcomeTitle}>
              Hei! Aku <span className={styles.welcomeBrand}>MetSchool AI</span>
            </h1>
            <p className={styles.welcomeSub}>
              Asisten belajar pintar yang siap membantu kapan saja — gratis, tanpa perlu daftar
            </p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  className={styles.suggestionChip}
                  onClick={() => sendMessage(s.text)}
                >
                  <span className={styles.suggestionIcon}>{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {hasMessages && (
          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <ChatMessage key={msg.id || i} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        {!hasMessages && <div ref={messagesEndRef} />}
      </main>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputContainer}>
          <form
            className={styles.inputBox}
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              ref={textareaRef}
              id="main-chat-input"
              className={styles.textarea}
              placeholder="Tanyakan apa saja..."
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              type="submit"
              id="main-send-btn"
              className={`${styles.sendBtn} ${(loading || !input.trim()) ? styles.sendBtnDisabled : ''}`}
            >
              {loading ? (
                <div className={styles.spinner} />
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>

          {/* Footer info */}
          <div className={styles.inputFooter}>
            {!user ? (
              <span className={styles.footerInfo}>
                {remaining > 0 ? (
                  <>⚡ {remaining} dari {GUEST_LIMIT} pesan gratis tersisa · </>
                ) : (
                  <>Batas pesan gratis tercapai · </>
                )}
                <button className={styles.footerLoginBtn} onClick={() => openLogin('limit')}>
                  Login untuk lanjut
                </button>
              </span>
            ) : (
              <span className={styles.footerInfo}>
                MetSchool AI dapat membuat kesalahan. Verifikasi informasi penting.
              </span>
            )}
            <span className={styles.authorCredit}>
              Made by <span className={styles.authorName}>Natan Silaban</span>
            </span>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          reason={loginReason}
          guestCount={guestCount}
          guestLimit={GUEST_LIMIT}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}

/* ── Chat Message Component ── */
function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAI}`}>
      {!isUser && <img src="/logo.png" alt="MetSchool AI" className={styles.aiAvatarImg} />}

      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAI}`}>
        {isUser ? (
          <p className={styles.userText}>{message.content}</p>
        ) : (
          <>
            <div className="markdown-content">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const code = String(children).replace(/\n$/, '');
                    if (!inline && match) {
                      return (
                        <div className={styles.codeBlock}>
                          <div className={styles.codeHeader}>
                            <span className={styles.codeLang}>{match[1]}</span>
                            <button
                              className={styles.copyCodeBtn}
                              onClick={() => navigator.clipboard.writeText(code)}
                            >
                              Copy
                            </button>
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0 0 10px 10px', background: '#071410' }}
                            {...props}
                          >
                            {code}
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

            {message.streaming && !message.content && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}

            {message.content && !message.streaming && (
              <div className={styles.msgActions}>
                <button className={styles.msgActionBtn} onClick={handleCopy}>
                  {copied ? '✓ Tersalin' : '⊕ Salin'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
