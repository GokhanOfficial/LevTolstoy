import React from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import {
  FilePlus, FolderOpen, Save, SaveAll, FileDown,
  Cloud, LogIn, LogOut, Sun, Moon, Contrast,
  Undo2, Redo2, Bold, Italic, Strikethrough,
  Link, Image, Code, ChevronRight,
} from 'lucide-react';

type Theme = 'light' | 'dark' | 'highContrast';

interface MenuBarProps {
  fileName: string;
  isDirty: boolean;
  isGoogleSignedIn: boolean;
  theme: Theme;
  showEditor: boolean;
  showPreview: boolean;
  onNew: () => void;
  onOpenLocal: () => void;
  onOpenDrive: () => void;
  onSaveLocal: () => void;
  onSaveDrive: () => void;
  onExportPdf: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAction: (type: string) => void;
  onThemeChange: (t: Theme) => void;
  onToggleEditor: () => void;
  onTogglePreview: () => void;
}

const itemClass = `
  flex items-center gap-2.5 px-3 py-1.5 rounded cursor-pointer select-none outline-none
  data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground
  data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed
`;

const separatorClass = `my-1 h-px`;

interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  onSelect: () => void;
  disabled?: boolean;
}

function Item({ icon, label, shortcut, onSelect, disabled }: MenuItemProps) {
  return (
    <Menubar.Item
      className={itemClass}
      onSelect={onSelect}
      disabled={disabled}
      style={{ fontSize: '13px', color: 'var(--foreground)' }}
    >
      {icon && <span style={{ color: 'var(--muted-foreground)', width: 16 }}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginLeft: '1rem' }}>
          {shortcut}
        </span>
      )}
    </Menubar.Item>
  );
}

function Separator() {
  return (
    <Menubar.Separator
      className={separatorClass}
      style={{ background: 'var(--border)' }}
    />
  );
}

function RadioItem({ label, value, currentValue, onSelect }: { label: string; value: string; currentValue: string; onSelect: () => void }) {
  return (
    <Menubar.RadioItem
      value={value}
      className={itemClass}
      onSelect={onSelect}
      style={{ fontSize: '13px', color: 'var(--foreground)' }}
    >
      <Menubar.ItemIndicator>
        <span style={{ color: 'var(--primary)' }}>✓</span>
      </Menubar.ItemIndicator>
      <span className="flex-1">{label}</span>
    </Menubar.RadioItem>
  );
}

const contentStyle: React.CSSProperties = {
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  boxShadow: 'var(--fluent-shadow)',
  padding: '4px',
  minWidth: '200px',
  zIndex: 50,
};

export function MenuBar({
  fileName, isDirty, isGoogleSignedIn, theme, showEditor, showPreview,
  onNew, onOpenLocal, onOpenDrive, onSaveLocal, onSaveDrive, onExportPdf,
  onGoogleSignIn, onGoogleSignOut, onUndo, onRedo, onAction,
  onThemeChange, onToggleEditor, onTogglePreview,
}: MenuBarProps) {
  const triggerStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '13px',
    color: 'var(--foreground)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
  };

  return (
    <div
      className="flex items-center border-b"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        height: '32px',
        flexShrink: 0,
      }}
    >
      {/* App icon + name */}
      <div
        className="flex items-center gap-2 px-3 border-r"
        style={{ borderColor: 'var(--border)', height: '100%' }}
      >
        <span style={{ fontSize: '16px' }} aria-hidden="true">📝</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
          Markdown Editor
        </span>
      </div>

      <Menubar.Root className="flex items-center h-full px-1">
        {/* File menu */}
        <Menubar.Menu>
          <Menubar.Trigger style={triggerStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            File
          </Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content style={contentStyle} sideOffset={2} align="start">
              <Item icon={<FilePlus size={14} />} label="New" shortcut="Ctrl+N" onSelect={onNew} />
              <Separator />
              <Menubar.Sub>
                <Menubar.SubTrigger
                  className={itemClass}
                  style={{ fontSize: '13px', color: 'var(--foreground)' }}
                >
                  <span style={{ color: 'var(--muted-foreground)', width: 16 }}><FolderOpen size={14} /></span>
                  <span className="flex-1">Open</span>
                  <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
                </Menubar.SubTrigger>
                <Menubar.Portal>
                  <Menubar.SubContent style={contentStyle} sideOffset={4}>
                    <Item icon={<FolderOpen size={14} />} label="Local file…" onSelect={onOpenLocal} />
                    <Item
                      icon={<Cloud size={14} />}
                      label="Google Drive…"
                      onSelect={onOpenDrive}
                      disabled={!isGoogleSignedIn}
                    />
                  </Menubar.SubContent>
                </Menubar.Portal>
              </Menubar.Sub>
              <Menubar.Sub>
                <Menubar.SubTrigger
                  className={itemClass}
                  style={{ fontSize: '13px', color: 'var(--foreground)' }}
                >
                  <span style={{ color: 'var(--muted-foreground)', width: 16 }}><Save size={14} /></span>
                  <span className="flex-1">Save</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginRight: 8 }}>Ctrl+S</span>
                  <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
                </Menubar.SubTrigger>
                <Menubar.Portal>
                  <Menubar.SubContent style={contentStyle} sideOffset={4}>
                    <Item icon={<Save size={14} />} label="Save locally" shortcut="Ctrl+S" onSelect={onSaveLocal} />
                    <Item
                      icon={<Cloud size={14} />}
                      label="Save to Google Drive"
                      onSelect={onSaveDrive}
                      disabled={!isGoogleSignedIn}
                    />
                  </Menubar.SubContent>
                </Menubar.Portal>
              </Menubar.Sub>
              <Separator />
              <Item icon={<FileDown size={14} />} label="Export as PDF" shortcut="Ctrl+Shift+P" onSelect={onExportPdf} />
              <Separator />
              {isGoogleSignedIn ? (
                <Item icon={<LogOut size={14} />} label="Sign out of Google" onSelect={onGoogleSignOut} />
              ) : (
                <Item icon={<LogIn size={14} />} label="Sign in with Google…" onSelect={onGoogleSignIn} />
              )}
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>

        {/* Edit menu */}
        <Menubar.Menu>
          <Menubar.Trigger style={triggerStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Edit
          </Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content style={contentStyle} sideOffset={2} align="start">
              <Item icon={<Undo2 size={14} />} label="Undo" shortcut="Ctrl+Z" onSelect={onUndo} />
              <Item icon={<Redo2 size={14} />} label="Redo" shortcut="Ctrl+Y" onSelect={onRedo} />
              <Separator />
              <Item icon={<Bold size={14} />} label="Bold" shortcut="Ctrl+B" onSelect={() => onAction('bold')} />
              <Item icon={<Italic size={14} />} label="Italic" shortcut="Ctrl+I" onSelect={() => onAction('italic')} />
              <Item icon={<Strikethrough size={14} />} label="Strikethrough" onSelect={() => onAction('strike')} />
              <Separator />
              <Item icon={<Link size={14} />} label="Insert Link" onSelect={() => onAction('link')} />
              <Item icon={<Image size={14} />} label="Insert Image" onSelect={() => onAction('image')} />
              <Item icon={<Code size={14} />} label="Insert Code Block" onSelect={() => onAction('codeBlock')} />
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>

        {/* View menu */}
        <Menubar.Menu>
          <Menubar.Trigger style={triggerStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            View
          </Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content style={contentStyle} sideOffset={2} align="start">
              <Menubar.CheckboxItem
                checked={showEditor}
                onCheckedChange={onToggleEditor}
                className={itemClass}
                style={{ fontSize: '13px', color: 'var(--foreground)' }}
              >
                <Menubar.ItemIndicator>✓</Menubar.ItemIndicator>
                <span className="flex-1 ml-1">Show Editor</span>
              </Menubar.CheckboxItem>
              <Menubar.CheckboxItem
                checked={showPreview}
                onCheckedChange={onTogglePreview}
                className={itemClass}
                style={{ fontSize: '13px', color: 'var(--foreground)' }}
              >
                <Menubar.ItemIndicator>✓</Menubar.ItemIndicator>
                <span className="flex-1 ml-1">Show Preview</span>
              </Menubar.CheckboxItem>
              <Separator />
              <Menubar.Label className="px-3 py-1" style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                Theme
              </Menubar.Label>
              <Menubar.RadioGroup value={theme} onValueChange={v => onThemeChange(v as Theme)}>
                <RadioItem label="☀ Light" value="light" currentValue={theme} onSelect={() => onThemeChange('light')} />
                <RadioItem label="🌙 Dark" value="dark" currentValue={theme} onSelect={() => onThemeChange('dark')} />
                <RadioItem label="◑ High Contrast" value="highContrast" currentValue={theme} onSelect={() => onThemeChange('highContrast')} />
              </Menubar.RadioGroup>
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>

        {/* Help menu */}
        <Menubar.Menu>
          <Menubar.Trigger style={triggerStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Help
          </Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content style={contentStyle} sideOffset={2} align="start">
              <Menubar.Item
                className={itemClass}
                style={{ fontSize: '13px', color: 'var(--foreground)' }}
                onSelect={() => window.open('https://www.markdownguide.org/basic-syntax/', '_blank')}
              >
                Basic Markdown Syntax ↗
              </Menubar.Item>
              <Menubar.Item
                className={itemClass}
                style={{ fontSize: '13px', color: 'var(--foreground)' }}
                onSelect={() => window.open('https://www.markdownguide.org/extended-syntax/', '_blank')}
              >
                Extended Syntax (GFM) ↗
              </Menubar.Item>
              <Separator />
              <Menubar.Item
                className={itemClass}
                style={{ fontSize: '13px', color: 'var(--foreground)' }}
                onSelect={() => window.open('https://www.w3.org/TR/WCAG21/', '_blank')}
              >
                WCAG 2.1 Accessibility ↗
              </Menubar.Item>
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>
      </Menubar.Root>

      {/* File title */}
      <div className="flex-1 flex items-center justify-center">
        <span
          style={{ fontSize: '12px', color: 'var(--muted-foreground)', userSelect: 'none' }}
          aria-label={`Current file: ${fileName}${isDirty ? ' (unsaved)' : ''}`}
        >
          {fileName}{isDirty ? ' ●' : ''}
        </span>
      </div>
    </div>
  );
}
