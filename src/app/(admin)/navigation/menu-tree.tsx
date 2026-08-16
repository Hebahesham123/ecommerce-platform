"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  MAX_DEPTH,
  addChild,
  moveItem,
  newItem,
  removeItem,
  updateItem,
  type NavItem,
} from "@/lib/navigation";
import { LinkPicker, type LinkTargets } from "@/components/link-picker";
import { IcPlus, IcTrash, IcChevron } from "@/components/icons";

/**
 * Recursive menu editor. Each row is a title + a destination picker, and any
 * row above the depth cap can hold children — which is how BAGS → HANDBAGS and
 * FOOTWEAR → FOR WOMEN → SNEAKERS get built.
 */
export function MenuTree({
  items,
  targets,
  onChange,
}: {
  items: NavItem[];
  targets: LinkTargets;
  onChange: (next: NavItem[]) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-ink-soft">
          {ar ? "لا توجد عناصر بعد" : "No items yet"}
        </p>
      )}

      {items.map((item, i) => (
        <Row
          key={item.id}
          item={item}
          index={i}
          siblings={items.length}
          depth={1}
          targets={targets}
          ar={ar}
          onPatch={(patch) => onChange(updateItem(items, item.id, patch))}
          onRemove={() => onChange(removeItem(items, item.id))}
          onMove={(d) => onChange(moveItem(items, item.id, d))}
          onAddChild={() => onChange(addChild(items, item.id, newItem()))}
          onChildChange={(children) => onChange(updateItem(items, item.id, { children }))}
        />
      ))}

      <button
        className="btn-outline w-full justify-center"
        onClick={() => onChange([...items, newItem()])}
      >
        <IcPlus className="h-4 w-4" /> {ar ? "إضافة عنصر" : "Add item"}
      </button>
    </div>
  );
}

function Row({
  item,
  index,
  siblings,
  depth,
  targets,
  ar,
  onPatch,
  onRemove,
  onMove,
  onAddChild,
  onChildChange,
}: {
  item: NavItem;
  index: number;
  siblings: number;
  depth: number;
  targets: LinkTargets;
  ar: boolean;
  onPatch: (patch: Partial<NavItem>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  onAddChild: () => void;
  onChildChange: (children: NavItem[]) => void;
}) {
  const [open, setOpen] = useState(item.children.length > 0);
  const canNest = depth < MAX_DEPTH;

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <div className="flex flex-col text-ink-soft">
          <button
            className="leading-none hover:text-ink disabled:opacity-30"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title={ar ? "لأعلى" : "Move up"}
          >
            ↑
          </button>
          <button
            className="leading-none hover:text-ink disabled:opacity-30"
            onClick={() => onMove(1)}
            disabled={index === siblings - 1}
            title={ar ? "لأسفل" : "Move down"}
          >
            ↓
          </button>
        </div>

        <input
          value={item.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder={ar ? "اسم العنصر" : "Item name"}
          className="h-9 min-w-[120px] flex-1 rounded-xl border border-line bg-surface-page px-3 text-sm font-medium text-ink outline-none focus:border-brand-600 focus:bg-surface"
        />

        <div className="min-w-[220px] flex-1">
          <LinkPicker
            type="url"
            value={item.url}
            targets={targets}
            ar={ar}
            onChange={(url) => onPatch({ url })}
          />
        </div>

        {canNest && (
          <button
            className="btn-ghost h-8 px-2 text-xs"
            onClick={() => {
              onAddChild();
              setOpen(true);
            }}
            title={ar ? "إضافة قائمة فرعية" : "Add a sub-item"}
          >
            <IcPlus className="h-3.5 w-3.5" />
            {ar ? "فرعي" : "Sub"}
          </button>
        )}
        <button
          className="btn-ghost h-8 px-2 text-rose-600 hover:bg-rose-50"
          onClick={onRemove}
          title={ar ? "حذف" : "Remove"}
        >
          <IcTrash className="h-3.5 w-3.5" />
        </button>
      </div>

      {item.children.length > 0 && (
        <>
          <button
            className="flex w-full items-center gap-1.5 border-t border-line px-3 py-1.5 text-[11px] font-medium text-ink-soft hover:text-ink"
            onClick={() => setOpen((o) => !o)}
          >
            <IcChevron
              className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""} rtl:-scale-x-100`}
            />
            {item.children.length} {ar ? "عنصر فرعي" : "sub-items"}
          </button>
          {open && (
            <div className="space-y-2 border-t border-line bg-surface-page p-2.5 ps-6">
              {item.children.map((child, i) => (
                <Row
                  key={child.id}
                  item={child}
                  index={i}
                  siblings={item.children.length}
                  depth={depth + 1}
                  targets={targets}
                  ar={ar}
                  onPatch={(patch) =>
                    onChildChange(updateItem(item.children, child.id, patch))
                  }
                  onRemove={() => onChildChange(removeItem(item.children, child.id))}
                  onMove={(d) => onChildChange(moveItem(item.children, child.id, d))}
                  onAddChild={() =>
                    onChildChange(addChild(item.children, child.id, newItem()))
                  }
                  onChildChange={(grandChildren) =>
                    onChildChange(
                      updateItem(item.children, child.id, { children: grandChildren }),
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
