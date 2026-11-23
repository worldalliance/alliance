export function Folder({ label, folder }: { label: string; folder: string }) {
  return (
    <p className="folder">
      <span className="folder-label">{label}</span>
      <span className="folder-path">{folder}</span>
    </p>
  );
}
