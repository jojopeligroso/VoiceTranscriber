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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
