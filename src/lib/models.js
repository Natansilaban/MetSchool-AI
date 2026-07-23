// Available AI Models
export const MODELS = [
  {
    id: 'gemini-flash-latest',
    name: 'Met Flash',
    description: 'Sangat cepat & serbaguna untuk tugas sehari-hari',
    tier: 'free',
    icon: '⚡',
    badge: 'GRATIS',
    badgeClass: 'badge-free',
    maxTokens: 8192,
  },
  {
    id: 'met-ai-2.5',
    name: 'Met AI 2.5',
    description: 'Lebih cerdas dengan pemahaman analisis tinggi',
    tier: 'free',
    icon: '🚀',
    badge: 'GRATIS',
    badgeClass: 'badge-free',
    maxTokens: 8192,
  },
  {
    id: 'met-pro-2.5',
    name: 'Met Pro 2.5',
    description: 'Model terkuat untuk analisis mendalam & coding kompleks',
    tier: 'premium',
    icon: '💎',
    badge: 'PREMIUM',
    badgeClass: 'badge-premium',
    maxTokens: 32768,
  },
];

// Get model by ID
export const getModelById = (id) => {
  return MODELS.find(m => m.id === id) || MODELS[0];
};

// Default system prompt
export const DEFAULT_SYSTEM_PROMPT = `Kamu adalah MetSchool AI, asisten belajar cerdas dan ramah yang membantu semua orang memahami berbagai topik dengan mudah.
Kamu sabar, informatif, dan menjelaskan dengan cara yang mudah dipahami oleh siapa saja.
Selalu jawab dengan jelas, terstruktur, dan dalam bahasa yang sama dengan pertanyaan user (Indonesia atau Inggris).
Gunakan markdown untuk formatting yang baik — bold, italic, bullet points, code block, dll.`;
