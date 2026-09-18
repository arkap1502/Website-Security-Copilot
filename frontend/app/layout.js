export const metadata = { title: "Website Security Copilot", description: "Scan any site, Always-On Guard verdict Safe/Harmful, auto-block demo." };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Segoe UI, Arial, sans-serif", background: "#0f172a", color: "#e2e8f0" }}>
        {children}
      </body>
    </html>
  );
}
