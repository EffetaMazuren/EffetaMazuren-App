'use client'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BarChart2, Calendar, Settings } from 'lucide-react'

const items = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
  { icon: Users, label: 'Personas', href: '/dashboard/personas' },
  { icon: BarChart2, label: 'Finanzas', href: '/dashboard/finanzas' },
  { icon: Calendar, label: 'Retiro', href: '/dashboard/retiro' },
  { icon: Settings, label: 'Config', href: '/dashboard/config' },
]

const PERSONAS_PATHS = ['/dashboard/personas', '/dashboard/caminantes', '/dashboard/servidores']

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard/personas') {
      return PERSONAS_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    }
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '0.5px solid #e5e7eb',
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 0 20px', zIndex: 100,
    }}>
      {items.map(({ icon: Icon, label, href }) => {
        const active = isActive(href)
        return (
          <button key={href} onClick={() => router.push(href)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '0 16px', background: 'none', border: 'none', cursor: 'pointer',
          }}>
            <Icon size={20} color={active ? '#0f1787' : '#d1d5db'} />
            <span style={{ fontSize: 10, fontWeight: 500, color: active ? '#0f1787' : '#d1d5db' }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
