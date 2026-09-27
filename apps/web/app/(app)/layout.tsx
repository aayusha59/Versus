/** Every page except the landing: the template's column, under the fixed header. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-6xl px-6 pt-36 pb-16 min-h-[70vh] md:pt-48">
      {children}
    </main>
  );
}
