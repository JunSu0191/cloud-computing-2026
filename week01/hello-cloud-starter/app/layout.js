import "./globals.css";

export const metadata = {
  title: "URL Shortener",
  description: "클라우드 컴퓨팅 URL Shortener 최종 과제",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
