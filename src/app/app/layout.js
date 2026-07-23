'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SidebarProvider } from '@/lib/SidebarContext';
import Sidebar from '@/components/layout/Sidebar';
import styles from './layout.module.css';

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && !user && forceReady) {
      router.replace('/login');
    }
  }, [user, loading, forceReady, router]);

  const isScreenLoading = loading && !forceReady;

  if (isScreenLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>Memuat MetSchool AI...</p>
      </div>
    );
  }

  if (!user && !forceReady) return null;

  return (
    <SidebarProvider>
      <div className={styles.appLayout}>
        <Sidebar />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
