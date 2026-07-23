'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import styles from './ToolPage.module.css';

export default function ToolPage({ tool, title, icon, description, inputPlaceholder, extraControls, getRequestBody }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setOutput('');
    setError('');

    try {
      const body = getRequestBody ? getRequestBody(input) : { tool, input };
      const response = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setOutput(full);
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError('');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>{icon}</div>
        <div>
          <h1 className={`${styles.title} font-display`}>{title}</h1>
          <p className={styles.desc}>{description}</p>
        </div>
      </div>

      <div className={styles.workspace}>
        {/* Input Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Input</span>
            <div className={styles.panelActions}>
              {extraControls}
              <button className="btn btn-ghost btn-sm" onClick={handleClear}>Hapus</button>
            </div>
          </div>
          <textarea
            id={`${tool}-input`}
            className={styles.textarea}
            placeholder={inputPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <div className={styles.panelFooter}>
            <span className={styles.charCount}>{input.length} karakter</span>
            <button
              id={`${tool}-run-btn`}
              className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
              onClick={run}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <>
                  <div className={styles.spinner} />
                  Memproses...
                </>
              ) : (
                <>
                  <span>{icon}</span>
                  {title}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Hasil</span>
            {output && (
              <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                {copied ? '✓ Copied!' : '⊕ Copy'}
              </button>
            )}
          </div>
          <div className={styles.outputArea}>
            {loading && !output && (
              <div className={styles.loadingState}>
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
                <span>AI sedang memproses...</span>
              </div>
            )}

            {error && (
              <div className={styles.errorState}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!loading && !output && !error && (
              <div className={styles.emptyState}>
                <span>{icon}</span>
                <p>Hasil akan muncul di sini...</p>
              </div>
            )}

            {output && (
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      if (!inline && match) {
                        return (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ borderRadius: '8px', marginTop: '8px', marginBottom: '8px' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        );
                      }
                      return <code className={className} {...props}>{children}</code>;
                    },
                  }}
                >
                  {output}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
