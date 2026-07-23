'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSidebar } from '@/lib/SidebarContext';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/app/chat', icon: '💬', label: 'Chat Baru', exact: true },
  { href: '/app/tools', icon: '🔧', label: 'AI Tools' },
];

const TOOL_ITEMS = [
  { href: '/app/tools/summarize', icon: '📄', label: 'Summarizer' },
  { href: '/app/tools/translate', icon: '🌐', label: 'Translator' },
  { href: '/app/tools/code', icon: '💻', label: 'Code Helper' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, signOut, isPremium, getRemainingMessages } = useAuth();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [conversations, setConversations] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      // Catch offline or permission error gracefully
      console.warn('Sidebar conversations listener warning:', err.message);
    });
    return () => unsub();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const remaining = getRemainingMessages();
  const premium = isPremium();

  return (
    <>
      <div
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropVisible : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarOpenMobile : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <Link href="/" className={styles.logoLink} onClick={() => setMobileOpen(false)}>
            <img src="/logo.png" alt="Metland School" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            {!collapsed && <span className={styles.logoText}>MetSchool AI</span>}
          </Link>
          <button
            className={`btn btn-ghost btn-icon-sm ${styles.collapseBtn}`}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>
              }
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className={styles.newChatWrap}>
          <Link
            href="/app/chat"
            className={`btn btn-primary ${styles.newChatBtn}`}
            id="new-chat-btn"
            onClick={(e) => {
              setMobileOpen(false);
              if (pathname === '/app/chat') {
                e.preventDefault();
                window.location.href = '/app/chat';
              }
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {!collapsed && 'Chat Baru'}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {!collapsed && <span className={styles.navSection}>Tools</span>}
          
          {TOOL_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Conversation History */}
        {!collapsed && conversations.length > 0 && (
          <div className={styles.conversations}>
            <span className={styles.navSection}>Riwayat</span>
            <div className={styles.convList}>
              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/app/chat/${conv.id}`}
                  className={`${styles.convItem} ${pathname === `/app/chat/${conv.id}` ? styles.convItemActive : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                <span className={styles.convIcon}>💬</span>
                <span className={styles.convTitle}>{conv.title || 'Untitled'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Usage indicator (free tier) */}
      {!collapsed && !premium && (
        <div className={styles.usage}>
          <div className={styles.usageHeader}>
            <span className={styles.usageLabel}>Pesan hari ini</span>
            <span className={styles.usageCount}>{remaining}/50</span>
          </div>
          <div className={styles.usageBar}>
            <div
              className={styles.usageBarFill}
              style={{ width: `${Math.min(100, Math.max(0, (remaining / 50) * 100))}%` }}
            />
          </div>
          <Link href="/app/settings" className={styles.upgradeBtn}>
            <span>⭐</span>
            Upgrade ke Premium
          </Link>
        </div>
      )}

      {!collapsed && premium && (
        <div className={styles.premiumBadge}>
          <span>💎</span>
          <span>Premium Active</span>
        </div>
      )}

      {/* User Profile */}
      <div className={styles.userProfile}>
        {user?.photoURL && (
          <img src={user.photoURL} alt="Profile" className={styles.avatar} />
        )}
        {!collapsed && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.displayName?.split(' ')[0]}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        )}
        <button
          className={`btn btn-ghost btn-icon-sm ${styles.signOutBtn}`}
          onClick={handleSignOut}
          title="Sign out"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '4px 16px 12px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
          Made by <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Natan Silaban</span>
        </div>
      )}
    </aside>
    </>
  );
}
