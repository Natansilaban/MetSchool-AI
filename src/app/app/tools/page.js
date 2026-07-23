'use client';

import Link from 'next/link';
import styles from './tools.module.css';

const TOOLS = [
  {
    id: 'summarize',
    href: '/app/tools/summarize',
    icon: '📄',
    title: 'Summarizer',
    description: 'Ringkas artikel panjang, dokumen, atau teks apapun menjadi poin-poin penting yang mudah dipahami.',
    color: 'cyan',
    badge: 'GRATIS',
  },
  {
    id: 'translate',
    href: '/app/tools/translate',
    icon: '🌐',
    title: 'Translator',
    description: 'Terjemahkan teks ke 100+ bahasa dengan konteks yang natural dan akurat.',
    color: 'emerald',
    badge: 'GRATIS',
  },
  {
    id: 'code',
    href: '/app/tools/code',
    icon: '💻',
    title: 'Code Helper',
    description: 'Debug, jelaskan, generate, dan review kode. Support semua bahasa pemrograman populer.',
    color: 'purple',
    badge: 'GRATIS',
  },
];

export default function ToolsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={`${styles.title} font-display`}>
          AI <span className="gradient-text">Tools</span>
        </h1>
        <p className={styles.desc}>
          Pilih tool yang kamu butuhkan. Semua gratis untuk pengguna Free.
        </p>
      </div>

      <div className={styles.toolsGrid}>
        {TOOLS.map((tool, i) => (
          <Link
            key={tool.id}
            href={tool.href}
            className={`card card-glow ${styles.toolCard} animate-fade-in-up delay-${(i + 1) * 100}`}
            id={`tool-card-${tool.id}`}
          >
            <div className={`${styles.toolIcon} ${styles[`icon${tool.color}`]}`}>
              {tool.icon}
            </div>
            <div className={styles.toolContent}>
              <div className={styles.toolTitleRow}>
                <h2 className={styles.toolTitle}>{tool.title}</h2>
                <span className="badge badge-free">{tool.badge}</span>
              </div>
              <p className={styles.toolDesc}>{tool.description}</p>
            </div>
            <div className={styles.toolArrow}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <div className={styles.chatCta}>
        <div className={styles.chatCtaContent}>
          <span className={styles.chatCtaIcon}>💬</span>
          <div>
            <h3 className={styles.chatCtaTitle}>Butuh yang lebih fleksibel?</h3>
            <p className={styles.chatCtaDesc}>Gunakan Chat AI untuk pertanyaan dan tugas apapun.</p>
          </div>
          <Link href="/app/chat" className="btn btn-primary" id="tools-to-chat">
            Buka Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
