import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList } from 'lucide-react'
import type { Role } from '../appTypes'
import { HiddenSoldierWorkshop } from './HiddenSoldierWorkshop'
import './LearningCenter.css'

export default function LearningExercisePage({ role }: { role: Role }) {
  return (
    <main className="learning-page wrap" dir="rtl">
      <nav className="breadcrumbs"><Link to="/learning">مركز التعلّم</Link><span>/</span><span>التطبيقات المهنية</span></nav>
      <header className="learning-self-paced learning-exercise-heading">
        <div>
          <span className="eyebrow"><ClipboardList size={14}/> تطبيق عملي مستقل</span>
          <h1>التطبيقات المهنية</h1>
          <p>مساحة التمارين وبطاقات إثبات الأثر، منفصلة عن نقاشات الورش.</p>
        </div>
        <Link className="btn btn-outline btn-small" to="/learning"><ArrowRight size={14}/> العودة إلى النقاشات</Link>
      </header>
      <HiddenSoldierWorkshop role={role}/>
    </main>
  )
}
