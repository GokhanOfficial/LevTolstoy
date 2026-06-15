import { useTaskStore } from '@/stores/taskStore'
import TaskCard from './TaskCard'
import { Activity, Layers } from 'lucide-react'

export default function TaskQueue() {
  const { tasks, queueStatus } = useTaskStore()
  const active = tasks.filter((t) => t.status === 'processing' || t.status === 'queued')

  if (active.length === 0) return null

  const slots = Array.from({ length: queueStatus.max }, (_, i) => i)

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-indigo-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-slate-300">İşlemler</h2>
        </div>
        {/* Concurrency slot indicator */}
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-slate-600" />
          <div className="flex gap-1">
            {slots.map((i) => (
              <div
                key={i}
                className={
                  i < queueStatus.active
                    ? 'h-2 w-2 rounded-full bg-indigo-500'
                    : 'h-2 w-2 rounded-full bg-slate-700'
                }
              />
            ))}
          </div>
          <span className="text-[11px] text-slate-600">
            {queueStatus.active}/{queueStatus.max} aktif
            {queueStatus.queued > 0 && ` · ${queueStatus.queued} bekliyor`}
          </span>
        </div>
      </div>

      {/* Task cards */}
      <div className="space-y-3">
        {active.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}
