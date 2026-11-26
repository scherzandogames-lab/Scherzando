import Image from 'next/image';

export default function SimpleHeader({ name }: { name: string }) {
  return (
    <header className="topbar">
      <a href="/" className="topbar-brand" aria-label={`${name}, inicio`}>
        <Image src="/marca/monograma.png" alt="" width={36} height={36} priority />
        <span>{name}</span>
      </a>
    </header>
  );
}
