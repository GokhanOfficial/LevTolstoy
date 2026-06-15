import { Zap } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import LangSwitch from './LangSwitch'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Zap className="size-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            Lev<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Tolstoy</span>
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <LangSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
