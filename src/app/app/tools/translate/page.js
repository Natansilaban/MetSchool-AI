'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import styles from '@/components/ToolPage.module.css';

const LANGUAGES = [
  'Inggris', 'Indonesia', 'Jepang', 'Korea', 'Mandarin', 'Spanyol',
  'Prancis', 'Jerman', 'Arab', 'Rusia', 'Italia', 'Portugis',
  'Hindi', 'Thai', 'Vietnam', 'Belanda',
];

export default function TranslatePage() {
  const [targetLang, setTargetLang] = useState('Inggris');

  return (
    <ToolPage
      tool="translate"
      title="Translator"
      icon="🌐"
      description="Terjemahkan teks ke 100+ bahasa secara natural"
      inputPlaceholder="Ketik atau paste teks yang ingin diterjemahkan..."
      extraControls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ke</span>
          <select
            className={styles.langSelect}
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            id="translate-lang-select"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      }
      getRequestBody={(input) => ({ tool: 'translate', input, targetLang })}
    />
  );
}
