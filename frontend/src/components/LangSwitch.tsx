import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'

export default function LangSwitch() {
  const { language, setLanguage } = useUIStore()

  return (
    <div className="flex items-center rounded-lg bg-muted p-1 gap-1">
      <Button
        variant={language === 'tr' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage('tr')}
      >
        TR
      </Button>
      <Button
        variant={language === 'en' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage('en')}
      >
        EN
      </Button>
    </div>
  )
}
