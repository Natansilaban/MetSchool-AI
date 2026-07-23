'use client';

import ToolPage from '@/components/ToolPage';

export default function SummarizePage() {
  return (
    <ToolPage
      tool="summarize"
      title="Summarizer"
      icon="📄"
      description="Ringkas teks panjang menjadi poin-poin penting"
      inputPlaceholder="Paste teks yang ingin diringkas di sini... (artikel, dokumen, berita, dll)"
      getRequestBody={(input) => ({ tool: 'summarize', input })}
    />
  );
}
