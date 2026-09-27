import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-6 pt-28 pb-16 min-h-[70vh]">
      <h1 className="text-4xl font-semibold">No such page</h1>
      <EmptyState className="mt-8" action={{ label: "Back to the board", href: "/board" }}>
        Nothing lives at this address. The board lists every duel.
      </EmptyState>
    </main>
  );
}
