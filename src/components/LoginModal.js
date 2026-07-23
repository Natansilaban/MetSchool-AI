'use client';

import { useState } from 'react';
import styles from './LoginModal.module.css';

export default function LoginModal({ reason, guestCount, guestLimit, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLimit = reason === 'limit' || guestCount >= guestLimit;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { auth } = await import('@/lib/firebase');
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      await signInWithPopup(auth, provider);
      // Clear guest count and go to full app
      localStorage.removeItem('metschool_guest_count');
      window.location.href = '/app/chat';
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Gagal login. Coba lagi.');
      }
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* Decorative glow */}
        <div className={styles.modalGlow} />

        {/* Icon */}
        <div className={styles.iconWrap}>
          <img src="/logo.png" alt="Metland School" style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }} />
        </div>

        {/* Content */}
        {isLimit ? (
          <>
            <div className={styles.limitBadge}>
              ⚡ {guestCount}/{guestLimit} pesan gratis terpakai
            </div>
            <h2 className={styles.title}>
              Pesan gratis habis!
            </h2>
            <p className={styles.desc}>
              Masuk untuk melanjutkan percakapan. Gratis, cepat, dan riwayat chat kamu akan tersimpan.
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>
              Masuk ke MetSchool AI
            </h2>
            <p className={styles.desc}>
              Login untuk menyimpan percakapan, akses riwayat, dan fitur lebih banyak.
            </p>
          </>
        )}

        {/* Google Button */}
        <button
          id="modal-google-login-btn"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <div className={styles.btnSpinner} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>{loading ? 'Memuat...' : 'Masuk dengan Google'}</span>
        </button>

        {error && <p className={styles.error}>{error}</p>}

        {/* Benefits */}
        <div className={styles.benefits}>
          <div className={styles.benefit}>
            <span className={styles.benefitCheck}>✓</span>
            <span>Pesan tanpa batas</span>
          </div>
          <div className={styles.benefit}>
            <span className={styles.benefitCheck}>✓</span>
            <span>Riwayat chat tersimpan</span>
          </div>
          <div className={styles.benefit}>
            <span className={styles.benefitCheck}>✓</span>
            <span>Gratis, tanpa kartu kredit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
