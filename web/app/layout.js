import "./global.css";

export const metadata = { title: "Price monitor" };

export default function RootLayout({ children }) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
