import { Moon, Sun, Monitor } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'

export default function ThemeToggle() {
  const { theme, setTheme } = useUIStore()

  const cycle = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label="Toggle theme">
      <Icon className="size-4" />
    </Button>
  )
}
