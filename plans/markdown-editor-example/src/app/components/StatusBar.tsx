import React from 'react';
import { Sun, Moon, Contrast, Cloud, CloudOff } from 'lucide-react';

type Theme = 'light' | 'dark' | 'highContrast';

interface StatusBarProps {
  line: number;
  col: number;
  wordCount: number;
  charCount: number;
  fileName: string;
  isDirty: boolean;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  isGoogleSignedIn: boolean;
  googleUserName?: string;
}

export function StatusBar({
  line, col, wordCount, charCount, fileName, isDirty,
  theme, onThemeChange, isGoogleSignedIn, googleUserName,
}: StatusBarProps) {
  const themes: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun size={13} />, label: 'Light mode' },
    { value: 'dark', icon: <Moon size={13} />, label: 'Dark mode' },
    { value: 'highContrast', icon: <Contrast size={13} />, label: 'High contrast (WCAG AA)' },
  ];

  return (
    <div
      role="status"
      aria-label="Editor status bar"
      className="flex items-center px-3 py-1 border-t select-none overflow-hidden"
      style={{
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        borderColor: 'transparent',
        height: '24px',
        fontSize: '11px',
        flexShrink: 0,
        gap: '12px',
      }}
    >
      {/* File info */}
      <span
        className="truncate max-w-xs"
        aria-label={`File: ${fileName}${isDirty ? ', unsaved changes' : ''}`}
      >
        {fileName}{isDirty ? ' ●' : ''}
      </span>

      <span aria-label={`Line ${line}, column ${col}`}>
        Ln {line}, Col {col}
      </span>

      <span aria-label={`${wordCount} words`}>
        {wordCount} words
      </span>

      <span aria-label={`${charCount} characters`}>
        {charCount} chars
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Google Drive status */}
      <span
        className="flex items-center gap-1 opacity-80"
        aria-label={isGoogleSignedIn ? `Signed in to Google as ${googleUserName}` : 'Not signed in to Google Drive'}
      >
        {isGoogleSignedIn ? <Cloud size={12} /> : <CloudOff size={12} />}
        {isGoogleSignedIn ? googleUserName ?? 'Google Drive' : 'Local only'}
      </span>

      {/* Theme switcher */}
      <div
        role="group"
        aria-label="Theme selection"
        className="flex items-center gap-0.5"
      >
        {themes.map(t => (
          <button
            key={t.value}
            onClick={() => onThemeChange(t.value)}
            title={t.label}
            aria-label={t.label}
            aria-pressed={theme === t.value}
            className="flex items-center justify-center rounded transition-opacity"
            style={{
              width: '20px',
              height: '18px',
              background: theme === t.value ? 'rgba(255,255,255,0.25)' : 'transparent',
              color: 'var(--primary-foreground)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
