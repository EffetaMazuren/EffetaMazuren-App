'use client'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BarChart2, Calendar, Settings } from 'lucide-react'

const items = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
  { icon: Users, label: 'Personas', href: '/dashboard/caminantes' },
  { icon: BarChart2, label: 'Finanzas', href: '/dashboard/finanzas' },
  { icon: Calendar, label: 'Retiro', href: '/dashboard/retiro' },
  { icon: Settings, label: 'Config', href: '/dashboard/config' },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '0.5px solid #e5e7eb',
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 0 20px', zIndex: 100,
    }}>
      {items.map(({ icon: Icon, label, href }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '0 16px', background: 'none', border: 'none',
              cursor: 'pointer',
            }}
          >
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
