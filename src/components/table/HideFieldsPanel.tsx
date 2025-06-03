import { X } from "lucide-react";
import { Button } from "~/components/ui/button";

interface HideFieldsPanelProps {
  columns: { id: string; name: string }[];
  hiddenFields: string[];
  setHiddenFields: (fields: string[]) => void;
  onClose: () => void;
}

export default function HideFieldsPanel({
  columns,
  hiddenFields,
  setHiddenFields,
  onClose,
}: HideFieldsPanelProps) {
  const allVisible = hiddenFields.length === 0;
  const allHidden = hiddenFields.length === columns.length;

  const handleToggle = (id: string) => {
    if (hiddenFields.includes(id)) {
      setHiddenFields(hiddenFields.filter((fid) => fid !== id));
    } else {
      setHiddenFields([...hiddenFields, id]);
    }
  };

  const handleHideAll = () => setHiddenFields(columns.map((col) => col.id));
  const handleShowAll = () => setHiddenFields([]);

  return (
    <div className="w-[340px] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-medium">Hide fields</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <input
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
        placeholder="Find a field"
        // Optionally implement search filter here
        disabled
      />
      <div className="mb-2 max-h-60 overflow-y-auto">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
          >
            <button
              className={`flex h-6 w-6 items-center justify-center rounded ${!hiddenFields.includes(col.id) ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"}`}
              onClick={() => handleToggle(col.id)}
              aria-label={hiddenFields.includes(col.id) ? "Show" : "Hide"}
            >
              {/* eye icon for visible, eye-off for hidden */}
              {!hiddenFields.includes(col.id) ? (
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-6.06M9.53 9.53A3.001 3.001 0 0 0 12 15a3 3 0 0 0 2.47-5.47" />
                  <path d="M1 1l22 22" />
                </svg>
              )}
            </button>
            <span className="flex-1 text-sm">{col.name}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleHideAll}
          disabled={allHidden}
          className="flex-1"
        >
          Hide all
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowAll}
          disabled={allVisible}
          className="flex-1"
        >
          Show all
        </Button>
      </div>
    </div>
  );
}
