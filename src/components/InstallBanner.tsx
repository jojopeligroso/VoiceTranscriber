'use client';

import { useState, useEffect, useCallback } from 'react';

const DISMISSED_KEY = 'pwa-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner({ show }: { show: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already dismissed or already installed as PWA
    const wasDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setDismissed(wasDismissed || isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (!show || !deferredPrompt || dismissed || installed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex items-center gap-3 rounded-lg border border-[var(--surface-alt)] bg-[var(--surface)] p-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--fg)]">Install VoiceTranscriber</p>
          <p className="text-xs text-[var(--muted)]">Works offline, launches instantly</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 px-3 py-1.5 rounded-md bg-[var(--accent)] text-[#05182e] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
