'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { user, userProfile, isPremium, setUserProfile } = useAuth();
  const [saved, setSaved] = useState(false);

  const handleSimulatePremium = async () => {
    if (!user) return;
    try {
      const newTier = isPremium() ? 'free' : 'premium';
      await updateDoc(doc(db, 'users', user.uid), { tier: newTier });
      setUserProfile(prev => ({ ...prev, tier: newTier }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={`${styles.title} font-display`}>Pengaturan</h1>
        <p className={styles.desc}>Kelola akun dan preferensi MetSchool AI kamu</p>
      </div>

      {/* Profile */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Profil</h2>
        <div className={styles.profileRow}>
          {user?.photoURL && (
            <img src={user.photoURL} alt="Profile" className={styles.profileAvatar} />
          )}
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>{user?.displayName}</span>
            <span className={styles.profileEmail}>{user?.email}</span>
            <div style={{ marginTop: 8 }}>
              {isPremium() ? (
                <span className="badge badge-premium">💎 Premium</span>
              ) : (
                <span className="badge badge-free">⚡ Free</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Plan Kamu</h2>

        {isPremium() ? (
          <div className={styles.premiumActive}>
            <div className={styles.premiumIcon}>💎</div>
            <div>
              <h3 className={styles.premiumTitle}>Premium Active</h3>
              <p className={styles.premiumDesc}>Kamu menikmati akses penuh ke semua fitur MetSchool AI.</p>
            </div>
          </div>
        ) : (
          <div className={styles.freePlan}>
            <div className={styles.freeStats}>
              <div className={styles.freeStat}>
                <span className={styles.freeStatValue}>50</span>
                <span className={styles.freeStatLabel}>Pesan/hari</span>
              </div>
              <div className={styles.freeStat}>
                <span className={styles.freeStatValue}>3</span>
                <span className={styles.freeStatLabel}>Model tersedia</span>
              </div>
            </div>
            <div className={styles.upgradeCard}>
              <div>
                <h3 className={styles.upgradeTitle}>Upgrade ke Premium</h3>
                <p className={styles.upgradeDesc}>Pesan unlimited, Met Pro 2.5, dan semua fitur eksklusif.</p>
                <div className={styles.upgradePrice}>
                  <span className={styles.upgradePriceValue}>Rp 49.000</span>
                  <span className={styles.upgradePricePeriod}>/bulan</span>
                </div>
              </div>
              <button className="btn btn-primary" id="upgrade-btn">
                Upgrade Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Dev: simulate premium toggle */}
        <div className={styles.devNote}>
          <p className={styles.devNoteText}>🛠️ Dev Mode: Simulasi toggle premium</p>
          <button
            className={`btn btn-secondary btn-sm ${styles.devToggle}`}
            onClick={handleSimulatePremium}
            id="dev-toggle-premium"
          >
            {saved ? '✓ Tersimpan!' : isPremium() ? 'Switch ke Free' : 'Simulate Premium'}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>API Key Gemini (Opsional)</h2>
        <p className={styles.sectionDesc}>
          Punya Gemini API key sendiri? Dapatkan gratis di{' '}
          <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className={styles.link}>
            Google AI Studio
          </a>
          {' '}dan tambahkan ke file <code className={styles.code}>.env.local</code>.
        </p>
        <div className={styles.envExample}>
          <code className={styles.envCode}>GEMINI_API_KEY=AIza...</code>
        </div>
      </div>

      {/* Danger Zone */}
      <div className={`card ${styles.section} ${styles.dangerSection}`}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Keluar</h2>
        <p className={styles.sectionDesc}>Keluar dari akun MetSchool AI kamu di perangkat ini.</p>
        <Link href="/" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
          Ke Halaman Utama
        </Link>
      </div>
    </div>
  );
}
