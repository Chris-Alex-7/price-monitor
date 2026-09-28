export const metadata = { title: "Price monitor" };

export default function RootLayout({ children }) {
  return (
    <html lang="el">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        {children}
      </body>
    </html>
  );
}
