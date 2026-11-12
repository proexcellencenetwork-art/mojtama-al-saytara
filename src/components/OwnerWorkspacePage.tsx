import { BarChart3, ShieldCheck } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Role } from '../appTypes'
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage'
import { OwnerPortalPage } from './OwnerPortalPage'
import './OwnerWorkspacePage.css'

export function OwnerWorkspacePage({ role }: { role: Role }) {
  const location = useLocation()
  const analyticsView = location.pathname.replace(/\/+$/, '').endsWith('/analytics')

  if (role !== 'owner') return <OwnerPortalPage role={role} />

  return (
    <div className="owner-workspace" dir="rtl">
      <header className="owner-workspace-intro wrap">
        <div className="owner-workspace-copy">
          <span className="eyebrow">مساحة المالك · وصول موحّد</span>
          <h1>مركز إدارة مجتمع السيطرة المهنية</h1>
          <p>إدارة المجتمع ومتابعة الزوار والعملاء وقياس الأداء من واجهة واحدة، مع بقاء كل قسم ضمن صلاحياته الحالية.</p>
        </div>
        <nav className="owner-workspace-switch" aria-label="أقسام مركز المالك">
          <NavLink to="/owner" end className={({ isActive }) => isActive ? 'active' : ''}>
            <ShieldCheck size={17} />
            <span>إدارة المجتمع</span>
          </NavLink>
          <NavLink to="/owner/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
            <BarChart3 size={17} />
            <span>الزوار والعملاء</span>
          </NavLink>
        </nav>
      </header>

      {analyticsView ? <AnalyticsDashboardPage role={role} /> : <OwnerPortalPage role={role} />}
    </div>
  )
}
