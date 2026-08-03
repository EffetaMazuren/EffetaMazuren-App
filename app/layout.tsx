import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Effetá Mazuren',
  description: 'Plataforma interna del grupo católico Effetá Mazuren',
  manifest: '/manifest.json',
  themeColor: '#0f1787',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
