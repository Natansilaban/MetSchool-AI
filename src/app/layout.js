import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'MetSchool AI — Asisten Belajar Pintar',
  description: 'MetSchool AI adalah asisten belajar berbasis AI pintar yang membantu siswa dan guru. Chat gratis tanpa perlu daftar, didukung Met Flash & Met Pro 2.5.',
  keywords: 'MetSchool AI, Asisten Belajar, Met Flash, Met Pro 2.5, Metland School, Chat AI, Indonesia',
  openGraph: {
    title: 'MetSchool AI — Asisten Belajar Pintar',
    description: 'Asisten belajar AI gratis didukung Met Flash & Met Pro 2.5.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
