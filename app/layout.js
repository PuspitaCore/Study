export const metadata = {
  title: 'Academic Paper Studio',
  description: 'Editor makalah akademik berbasis XML',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
