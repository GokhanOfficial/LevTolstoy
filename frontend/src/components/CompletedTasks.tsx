import { useTaskStore } from '@/stores/taskStore'
import ResultCard from './ResultCard'
import { CheckCircle2 } from 'lucide-react'

export default function CompletedTasks() {
  const { tasks } = useTaskStore()
  const done = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  )

  if (done.length === 0) return null

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-slate-300">Tamamlananlar</h2>
        <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {done.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {done.map((task) => (
          <ResultCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}
