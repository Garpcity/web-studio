export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
