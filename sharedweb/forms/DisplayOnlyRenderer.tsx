import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import RenderDisplayBlock from "./RenderDisplayBlock";

export default function DisplayOnlyRenderer({
  schema,
}: {
  schema: DisplayOnlySchema | null;
}) {
  if (!schema) {
    return (
      <div
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
        role="alert"
      >
        <p className="font-medium">This update can&apos;t be displayed</p>
        <p className="mt-1 text-sm">Refreshing the page may fix the issue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {schema.blocks.map((block, index) => (
        <RenderDisplayBlock key={block.id ?? `block-${index}`} block={block} />
      ))}
    </div>
  );
}
