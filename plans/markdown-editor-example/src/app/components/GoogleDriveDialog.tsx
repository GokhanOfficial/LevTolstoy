import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cloud, X, File, Folder, RefreshCw, LogOut, Search, Upload, Save } from 'lucide-react';

// Replace with your Google Cloud Console OAuth2 client ID
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

interface GoogleDriveDialogProps {
  open: boolean;
  mode: 'open' | 'save';
  fileName: string;
  onClose: () => void;
  onFileOpen: (content: string, name: string, fileId: string) => void;
  onFileSave: (fileId: string | null, name: string) => Promise<string>;
  token: string | null;
  onTokenChange: (token: string | null, userInfo?: { name: string; email: string }) => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleDriveDialog({
  open, mode, fileName, onClose, onFileOpen, onFileSave, token, onTokenChange,
}: GoogleDriveDialogProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFileName, setSaveFileName] = useState(fileName);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [query, setQuery] = useState('');
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [gisLoaded, setGisLoaded] = useState(false);

  // Load Google Identity Services
  useEffect(() => {
    if (document.getElementById('gis-script')) {
      setGisLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => setGisLoaded(true);
    script.onerror = () => setError('Failed to load Google Identity Services.');
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!gisLoaded || !window.google) return;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (resp: any) => {
        if (resp.error) {
          setError('Authentication failed: ' + resp.error_description);
          return;
        }
        const t = resp.access_token;
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${t}` },
          });
          const info = await res.json();
          onTokenChange(t, { name: info.name, email: info.email });
        } catch {
          onTokenChange(t);
        }
      },
    });
    setTokenClient(client);
  }, [gisLoaded, onTokenChange]);

  const signIn = useCallback(() => {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      setError('Google OAuth is not configured. Please replace GOOGLE_CLIENT_ID in GoogleDriveDialog.tsx with your actual Client ID from Google Cloud Console.');
      return;
    }
    if (!tokenClient) {
      setError('Google Identity Services not ready. Please try again.');
      return;
    }
    tokenClient.requestAccessToken({ prompt: '' });
  }, [tokenClient]);

  const signOut = useCallback(() => {
    if (token && window.google) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
    onTokenChange(null);
    setFiles([]);
  }, [token, onTokenChange]);

  const listFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = encodeURIComponent(
        `mimeType='text/markdown' or name contains '.md'` +
        (query ? ` and name contains '${query}'` : '')
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime+desc&pageSize=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load files.');
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  useEffect(() => {
    if (open && token) listFiles();
    setSaveFileName(fileName);
    setSelectedFile(null);
  }, [open, token, fileName]);

  const handleOpen = useCallback(async (file: DriveFile) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
      const text = await res.text();
      onFileOpen(text, file.name, file.id);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to open file.');
    } finally {
      setLoading(false);
    }
  }, [token, onFileOpen, onClose]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const fileId = await onFileSave(selectedFile?.id ?? null, saveFileName);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save file.');
    } finally {
      setLoading(false);
    }
  }, [token, onFileSave, selectedFile, saveFileName, onClose]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col"
          style={{
            width: '560px',
            maxHeight: '80vh',
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            borderRadius: '8px',
            boxShadow: 'var(--fluent-shadow)',
            border: '1px solid var(--border)',
            outline: 'none',
          }}
          aria-describedby="drive-dialog-desc"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <Cloud size={18} style={{ color: 'var(--primary)' }} />
            <Dialog.Title className="flex-1" style={{ fontWeight: 600 }}>
              {mode === 'open' ? 'Open from Google Drive' : 'Save to Google Drive'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close dialog"
                className="rounded p-1 transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <p id="drive-dialog-desc" className="sr-only">
            {mode === 'open' ? 'Browse and open a Markdown file from Google Drive.' : 'Save the current file to Google Drive.'}
          </p>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
            {!token ? (
              /* Sign-in prompt */
              <div className="flex flex-col items-center justify-center gap-4 py-10">
                <Cloud size={40} style={{ color: 'var(--muted-foreground)' }} />
                <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '300px' }}>
                  Sign in with your Google account to access Google Drive.
                </p>
                {error && (
                  <p
                    role="alert"
                    className="text-sm rounded p-3 w-full"
                    style={{ background: 'rgba(196,43,28,0.1)', color: 'var(--destructive)', border: '1px solid var(--destructive)' }}
                  >
                    {error}
                  </p>
                )}
                <button
                  onClick={signIn}
                  className="flex items-center gap-2 px-5 py-2 rounded"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  <Cloud size={16} /> Sign in with Google
                </button>
              </div>
            ) : (
              <>
                {/* Signed in header */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center rounded border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--input-background)' }}>
                    <Search size={14} className="ml-3" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && listFiles()}
                      placeholder="Search markdown files…"
                      aria-label="Search files"
                      className="flex-1 px-3 py-1.5 outline-none bg-transparent"
                      style={{ color: 'var(--foreground)', fontSize: '13px' }}
                    />
                  </div>
                  <button
                    onClick={listFiles}
                    title="Refresh file list"
                    aria-label="Refresh"
                    disabled={loading}
                    className="p-2 rounded border"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={signOut}
                    title="Sign out"
                    aria-label="Sign out of Google"
                    className="p-2 rounded border"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} />
                  </button>
                </div>

                {error && (
                  <p role="alert" className="text-sm rounded p-2" style={{ background: 'rgba(196,43,28,0.1)', color: 'var(--destructive)' }}>
                    {error}
                  </p>
                )}

                {/* File list */}
                <div
                  role="listbox"
                  aria-label="Google Drive files"
                  className="flex-1 overflow-y-auto rounded border"
                  style={{ borderColor: 'var(--border)', minHeight: '200px', maxHeight: '320px' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center py-10" style={{ color: 'var(--muted-foreground)' }}>
                      <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
                    </div>
                  ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: 'var(--muted-foreground)' }}>
                      <Folder size={28} />
                      <span>No markdown files found in Drive</span>
                    </div>
                  ) : (
                    files.map(file => (
                      <div
                        key={file.id}
                        role="option"
                        aria-selected={selectedFile?.id === file.id}
                        onClick={() => {
                          setSelectedFile(file);
                          if (mode === 'save') setSaveFileName(file.name);
                        }}
                        onDoubleClick={() => mode === 'open' && handleOpen(file)}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                        style={{
                          background: selectedFile?.id === file.id ? 'var(--accent)' : 'transparent',
                          color: selectedFile?.id === file.id ? 'var(--accent-foreground)' : 'var(--foreground)',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e => {
                          if (selectedFile?.id !== file.id) {
                            (e.currentTarget as HTMLDivElement).style.background = 'var(--muted)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (selectedFile?.id !== file.id) {
                            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                          }
                        }}
                      >
                        <File size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span className="flex-1 truncate" style={{ fontSize: '13px' }}>{file.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                          {formatDate(file.modifiedTime)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Save filename input */}
                {mode === 'save' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="save-filename" style={{ color: 'var(--muted-foreground)', fontSize: '13px', flexShrink: 0 }}>
                      File name:
                    </label>
                    <input
                      id="save-filename"
                      type="text"
                      value={saveFileName}
                      onChange={e => setSaveFileName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded border outline-none"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--input-background)',
                        color: 'var(--foreground)',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {token && (
            <div
              className="flex items-center justify-end gap-2 px-5 py-3 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded border"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '13px' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              {mode === 'open' ? (
                <button
                  onClick={() => selectedFile && handleOpen(selectedFile)}
                  disabled={!selectedFile || loading}
                  className="px-4 py-1.5 rounded flex items-center gap-2"
                  style={{
                    background: selectedFile ? 'var(--primary)' : 'var(--muted)',
                    color: selectedFile ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: selectedFile ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Upload size={14} /> Open
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={!saveFileName.trim() || loading}
                  className="px-4 py-1.5 rounded flex items-center gap-2"
                  style={{
                    background: saveFileName.trim() ? 'var(--primary)' : 'var(--muted)',
                    color: saveFileName.trim() ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: saveFileName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Save size={14} /> {loading ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
