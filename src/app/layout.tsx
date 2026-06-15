import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceTranscriber",
  description: "Private voice-to-text transcription",
  icons: {
    icon: "/favicon.svg",
  },
};

const themeScript = `
(function() {
  var t = localStorage.getItem('theme');
  var d = document.documentElement;
  if (t === 'light') {
    d.classList.remove('dark');
  } else {
    d.classList.add('dark');
  }
})();
`;

// Evict any stale service worker left over from the old PWA build so it can't
// serve cached app-shell assets. Does NOT clear Cache Storage, so the
// transformers.js model cache is preserved (blanket cache-clearing previously
// caused the model to re-download on every load).
const swCleanupScript = `
if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); }); }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swCleanupScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
