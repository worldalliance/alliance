import { useId } from "react";

export default function NotifyMemberCheckbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-0.5"
      />
      <label htmlFor={id}>
        {props.label}
        <span className="block text-xs text-zinc-500">
          Sends a push and an in-app notice naming the action&apos;s new title.
        </span>
      </label>
    </div>
  );
}
