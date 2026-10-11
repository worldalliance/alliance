import type { PageItem } from "@alliance/common/forms/form-schema";
import { describeElement } from "./canvasSelection";
import { SectionPanels } from "./sidebarSections";

export function RangeSettings({
  members,
  onSelectMember,
}: {
  members: PageItem[];
  onSelectMember: (offset: number) => void;
}) {
  return (
    <SectionPanels
      content={
        <ol aria-label="Selected elements" className="space-y-1">
          {members.map((member, offset) => (
            <li key={member.id || offset}>
              <button
                type="button"
                onClick={() => onSelectMember(offset)}
                className="w-full truncate rounded-md border border-gray-200 px-2 py-1 text-left text-sm text-gray-800 hover:text-blue-700"
              >
                {describeElement(member)}
              </button>
            </li>
          ))}
        </ol>
      }
    />
  );
}
