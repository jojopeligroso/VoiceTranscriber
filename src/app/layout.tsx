import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceTranscriber",
  description: "Private voice-to-text transcription that runs entirely in your browser",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VoiceTranscriber",
  },
  other: {
    "mobile-web-app-capable": "yes",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0a1628" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            if (!iOS && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
          })();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
