// SelectAllCheckbox: tri-state checkbox for a group of files.
// Checked when all selected, dash (indeterminate) when partially selected.

export function SelectAllCheckbox({
  label,
  names,
  selected,
  onSelectAll,
}: {
  label: string;
  names: string[];
  selected: ReadonlySet<string>;
  onSelectAll: (filenames: string[], select: boolean) => void;
}) {
  const selectedCount = names.filter((name) => selected.has(name)).length;
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--gtu-text-secondary)]">
      <input
        type="checkbox"
        ref={(el) => {
          if (el) {
            el.indeterminate =
              selectedCount > 0 && selectedCount < names.length;
          }
        }}
        checked={names.length > 0 && selectedCount === names.length}
        onChange={(event) => onSelectAll(names, event.target.checked)}
        aria-label={label}
        className="h-4 w-4 cursor-pointer accent-[#4f8cff]"
      />
      All
    </label>
  );
}
