import { Link, useLocation, Outlet } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'
import { clsx } from 'clsx'

export function NavBar() {
  const { pathname } = useLocation()

  const navItems = [
    { label: 'Schedule', to: '/' },
    { label: 'Patients', to: '/patients' },
    { label: 'Events', to: '/events' },
  ]

  return (
    <>
      <nav className="border-b bg-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-800 text-lg">Patient Management</span>
          <div className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
                  pathname === item.to
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <UserButton afterSignOutUrl="/login" />
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </>
  )
}
