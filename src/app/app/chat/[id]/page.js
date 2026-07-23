'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChatPageClient from '../ChatPageClient';

export default function ConversationPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams?.id;
  const { user } = useAuth();
  const [initialMessages, setInitialMessages] = useState([]);
  const [initialModel, setInitialModel] = useState('gemini-flash-latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (!user) return;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1000);

    const load = async () => {
      try {
        const convDoc = await getDoc(doc(db, 'conversations', id));
        if (convDoc.exists() && isMounted) {
          const data = convDoc.data();
          if (data.userId === user.uid) {
            setInitialMessages(data.messages || []);
            setInitialModel(data.model || 'gemini-flash-latest');
          }
        }
      } catch (e) {
        console.warn('Firestore load conversation warning:', e.message || e);
      } finally {
        if (isMounted) setLoading(false);
        clearTimeout(timer);
      }
    };
    load();
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [user, id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: '14px' }}>
        Memuat percakapan...
      </div>
    );
  }

  return (
    <ChatPageClient
      conversationId={id}
      initialMessages={initialMessages}
      initialModel={initialModel}
    />
  );
}
