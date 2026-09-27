import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <div className="pt-12">
      <h1 className="display text-2xl">No such page</h1>
      <hr className="double mt-5" />
      <EmptyState action={{ label: "Back to the board", href: "/" }}>
        Nothing is printed at this address. The board lists every duel.
      </EmptyState>
    </div>
  );
}
