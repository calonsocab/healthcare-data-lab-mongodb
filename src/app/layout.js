// src/app/layout.js
import './globals.css'
import { SessionProvider } from '@/providers/SessionProvider'

export const metadata = {
  title: 'MongoDB Healthcare Data Lab',
  description: 'Clinical Data Management Platform powered by MongoDB and OpenEHR',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}