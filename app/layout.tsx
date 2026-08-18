import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RetiroProvider } from '@/lib/retiro-context'

export const metadata: Metadata = {
  title: 'Effetá Mazuren',
  description: 'Plataforma interna del grupo católico Effetá Mazuren',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f1787',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <RetiroProvider>{children}</RetiroProvider>
      </body>
    </html>
  )
}
