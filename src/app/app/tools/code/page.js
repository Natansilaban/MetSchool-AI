'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';

const CODE_ACTIONS = [
  { value: 'Analisis dan jelaskan', label: '🔍 Analisis & Jelaskan' },
  { value: 'Debug dan temukan bug', label: '🐛 Debug' },
  { value: 'Optimasi dan refactor', label: '⚡ Optimasi' },
  { value: 'Tambahkan komentar dan dokumentasi', label: '📝 Dokumentasi' },
  { value: 'Konversi ke bahasa lain', label: '🔄 Konversi Bahasa' },
];

export default function CodePage() {
  const [action, setAction] = useState(CODE_ACTIONS[0].value);

  return (
    <ToolPage
      tool="code"
      title="Code Helper"
      icon="💻"
      description="Debug, jelaskan, optimasi, dan dokumentasi kode"
      inputPlaceholder="Paste kode di sini..."
      extraControls={
        <select
          style={{
            padding: '6px 10px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
          }}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          id="code-action-select"
        >
          {CODE_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      }
      getRequestBody={(input) => ({ tool: 'code', input, instruction: action })}
    />
  );
}
