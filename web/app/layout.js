import "./global.css";

export const metadata = { title: "Τιμές ΜΕΒΓΑΛ" };

export default function RootLayout({ children }) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  );
}
