'use client';
import { useState } from 'react';

/** Copia un dato (CBU, alias, importe) para pegarlo en la aplicación del banco. */
export default function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {}
      }}
    >
      {ok ? 'Copiado' : 'Copiar'}
    </button>
  );
}
