'use client';

import { useEffect, useRef, useState } from 'react';
import './globals.css';

export default function Home() {
  const frame = useRef(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type !== 'ripidoc-save') return;
      fetch('/api/documents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event.data.payload) })
        .then((r) => r.ok ? setMessage('Tersimpan ke SQLite') : setMessage('Gagal menyimpan'))
        .catch(() => setMessage('API belum siap — jalankan migrasi Prisma'));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return <main className="shell">
    <div className="db-status">{message}</div>
    <iframe ref={frame} title="RipiDoc Studio" src="/academic_paper_studio_xml_multiview.html" />
  </main>;
}
