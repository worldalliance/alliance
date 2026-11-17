import { CATEGORIES } from "@alliance/kora-review/categories";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useKoraCategoriesAdmin } from "../lib/useKoraBatchesAdmin";

const CELL = "px-3 py-2 align-top";
const NUM = `${CELL} text-right tabular-nums`;

const label = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

function CategoryList() {
  const categories = useKoraCategoriesAdmin();
  if (categories.isPending) {
    return <p className="text-sm">Loading categories…</p>;
  }
  if (categories.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {adminRefusalMessage(
          categories.error,
          "Couldn't load the categories. Reload to try again.",
        )}
      </p>
    );
  }
  if (categories.data.length === 0) {
    return <p className="text-sm text-zinc-600">No open batches.</p>;
  }
  return (
    <table className="text-sm">
      <thead className="text-left text-zinc-500">
        <tr>
          <th className={CELL}>Category</th>
          <th className={`${CELL} text-right`}>Pairs</th>
          <th className={`${CELL} text-right`}>Reviews needed</th>
          <th className={`${CELL} text-right`}>Opted out</th>
        </tr>
      </thead>
      <tbody>
        {categories.data.map((c) => (
          <tr key={c.category} className="border-t border-zinc-200">
            <td className={CELL}>{label(c.category)}</td>
            <td className={NUM}>{c.pairs}</td>
            <td className={NUM}>{c.reviewsNeeded}</td>
            <td className={NUM}>{c.optedOut}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KoraCategories() {
  return (
    <section aria-labelledby="kora-categories" className="space-y-3">
      <h2 id="kora-categories" className="font-semibold">
        Categories
      </h2>
      <p className="text-sm text-zinc-600">
        Pairs in open batches. Reviews needed is how many more reviews their
        pairs need, after finished reviews and pairs held in unfinished
        assignments. Opted out counts participants who skipped the category;
        they aren&apos;t given its pairs again.
      </p>
      <CategoryList />
    </section>
  );
}
