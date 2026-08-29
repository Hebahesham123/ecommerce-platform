"use client";

import { useMemo, useState } from "react";
import {
  renderEmailHtml,
  newBlock,
  BLOCK_LABELS,
  MERGE_TAGS,
  SAMPLE_CONTEXT,
  type EmailBlock,
  type EmailBlockType,
  type EmailTemplate,
  type EmailProduct,
} from "@/lib/email";
import { listStoreProducts, type StoreProduct } from "@/app/store/actions";

const BLOCK_ORDER: EmailBlockType[] = [
  "logo",
  "heading",
  "text",
  "image",
  "button",
  "products",
  "divider",
  "spacer",
  "footer",
];

const BLOCK_ICON: Record<EmailBlockType, string> = {
  logo: "🏷️",
  heading: "🔠",
  text: "¶",
  image: "🖼️",
  button: "🔘",
  products: "🛍️",
  divider: "―",
  spacer: "␣",
  footer: "⚓",
};

// ---- Small field primitives -------------------------------------------------
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

function TextField(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className={inputCls}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}
function TextArea(props: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      className={`${inputCls} resize-y`}
      rows={props.rows ?? 4}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}
function NumberField(props: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      className={inputCls}
      value={props.value}
      min={props.min}
      max={props.max}
      onChange={(e) => props.onChange(Number(e.target.value) || 0)}
    />
  );
}
function ColorField(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <input className={inputCls} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}
function AlignField(props: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <div className="flex gap-1">
      {(["left", "center", "right"] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => props.onChange(a)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize ${
            props.value === a ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-muted hover:bg-surface-hover"
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

// ---- Block inspector --------------------------------------------------------
function Inspector({
  block,
  patch,
}: {
  block: EmailBlock;
  patch: (p: Partial<EmailBlock>) => void;
}) {
  // Casts are safe: `patch` merges into the same block, which the parent knows.
  const p = patch as (x: Record<string, unknown>) => void;
  switch (block.type) {
    case "logo":
      return (
        <div className="space-y-3">
          <Row label="Logo image URL"><TextField value={block.src} onChange={(v) => p({ src: v })} placeholder="https://…/logo.png" /></Row>
          <Row label="Width (px)"><NumberField value={block.width} onChange={(v) => p({ width: v })} min={40} max={400} /></Row>
          <Row label="Align"><AlignField value={block.align} onChange={(v) => p({ align: v })} /></Row>
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <Row label="Image URL"><TextField value={block.src} onChange={(v) => p({ src: v })} placeholder="https://…" /></Row>
          <Row label="Links to (optional)"><TextField value={block.href} onChange={(v) => p({ href: v })} placeholder="https://" /></Row>
          <Row label="Align"><AlignField value={block.align} onChange={(v) => p({ align: v })} /></Row>
        </div>
      );
    case "heading":
      return (
        <div className="space-y-3">
          <Row label="Text"><TextArea rows={2} value={block.text} onChange={(v) => p({ text: v })} /></Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Size"><NumberField value={block.size} onChange={(v) => p({ size: v })} min={14} max={44} /></Row>
            <Row label="Color"><ColorField value={block.color} onChange={(v) => p({ color: v })} /></Row>
          </div>
          <Row label="Align"><AlignField value={block.align} onChange={(v) => p({ align: v })} /></Row>
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <Row label="Text (**bold**, new lines OK)"><TextArea value={block.text} onChange={(v) => p({ text: v })} /></Row>
          <Row label="Color"><ColorField value={block.color} onChange={(v) => p({ color: v })} /></Row>
          <Row label="Align"><AlignField value={block.align} onChange={(v) => p({ align: v })} /></Row>
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <Row label="Label"><TextField value={block.text} onChange={(v) => p({ text: v })} /></Row>
          <Row label="Links to"><TextField value={block.href} onChange={(v) => p({ href: v })} placeholder="https://" /></Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Background"><ColorField value={block.bg} onChange={(v) => p({ bg: v })} /></Row>
            <Row label="Text color"><ColorField value={block.color} onChange={(v) => p({ color: v })} /></Row>
          </div>
          <Row label="Align"><AlignField value={block.align} onChange={(v) => p({ align: v })} /></Row>
        </div>
      );
    case "divider":
      return <Row label="Color"><ColorField value={block.color} onChange={(v) => p({ color: v })} /></Row>;
    case "spacer":
      return <Row label="Height (px)"><NumberField value={block.height} onChange={(v) => p({ height: v })} min={4} max={120} /></Row>;
    case "footer":
      return (
        <div className="space-y-3">
          <Row label="Footer text"><TextArea value={block.text} onChange={(v) => p({ text: v })} /></Row>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={block.unsubscribe} onChange={(e) => p({ unsubscribe: e.target.checked })} />
            Show unsubscribe link
          </label>
        </div>
      );
    case "products":
      return <ProductInspector block={block} p={p} />;
    default:
      return null;
  }
}

function ProductInspector({
  block,
  p,
}: {
  block: Extract<EmailBlock, { type: "products" }>;
  p: (x: Record<string, unknown>) => void;
}) {
  const [store, setStore] = useState<StoreProduct[] | null>(null);
  const [loading, setLoading] = useState(false);

  const setItem = (i: number, patch: Partial<EmailProduct>) => {
    const items = block.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    p({ items });
  };
  const addItem = (item: EmailProduct) => p({ items: [...block.items, item] });
  const removeItem = (i: number) => p({ items: block.items.filter((_, idx) => idx !== i) });

  async function loadStore() {
    setLoading(true);
    const res = await listStoreProducts();
    setLoading(false);
    if (res.ok) setStore(res.data);
  }

  return (
    <div className="space-y-3">
      <Row label="Section heading (optional)"><TextField value={block.heading} onChange={(v) => p({ heading: v })} /></Row>
      <Row label="Columns">
        <div className="flex gap-1">
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => p({ columns: n })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${
                block.columns === n ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-muted hover:bg-surface-hover"
              }`}
            >
              {n} columns
            </button>
          ))}
        </div>
      </Row>

      <div className="space-y-2">
        {block.items.map((it, i) => (
          <div key={i} className="rounded-xl border border-line p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Product {i + 1}</span>
              <button type="button" onClick={() => removeItem(i)} className="text-xs text-rose-600 hover:underline">Remove</button>
            </div>
            <div className="space-y-1.5">
              <TextField value={it.title} onChange={(v) => setItem(i, { title: v })} placeholder="Title" />
              <div className="grid grid-cols-2 gap-1.5">
                <TextField value={it.price} onChange={(v) => setItem(i, { price: v })} placeholder="Price e.g. 250 EGP" />
                <TextField value={it.href} onChange={(v) => setItem(i, { href: v })} placeholder="Link" />
              </div>
              <TextField value={it.image} onChange={(v) => setItem(i, { image: v })} placeholder="Image URL" />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addItem({ title: "Product", price: "", image: "", href: "https://" })}
        className="btn-outline h-8 w-full text-xs"
      >
        + Add product manually
      </button>

      <div className="rounded-xl border border-dashed border-line p-2">
        {store == null ? (
          <button type="button" onClick={loadStore} disabled={loading} className="btn-ghost h-8 w-full text-xs text-brand-600">
            {loading ? "Loading store…" : "🛍️ Add from your store"}
          </button>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {store.length === 0 && <p className="p-2 text-xs text-ink-soft">No products found.</p>}
            {store.map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() =>
                  addItem({
                    title: sp.name,
                    price: sp.priceMin != null ? `${sp.priceMin} EGP` : "",
                    image: sp.image ?? "",
                    href: `/store/product/${sp.id}`,
                  })
                }
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-surface-hover"
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-line bg-surface-page">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {sp.image ? <img src={sp.image} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{sp.name}</span>
                <span className="text-xs text-ink-soft">{sp.priceMin != null ? `${sp.priceMin}` : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Editor -----------------------------------------------------------------
export function BlockEditor({
  value,
  onChange,
  onSave,
  onBack,
  saved,
}: {
  value: EmailTemplate;
  onChange: (t: EmailTemplate) => void;
  onSave: () => void;
  onBack: () => void;
  saved: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(value.blocks[0]?.id ?? null);
  const [tab, setTab] = useState<"block" | "design">("block");
  const [showAdd, setShowAdd] = useState(false);

  const selected = value.blocks.find((b) => b.id === selectedId) ?? null;

  const setBlocks = (blocks: EmailBlock[]) => onChange({ ...value, blocks });
  const patchBlock = (id: string, p: Partial<EmailBlock>) =>
    setBlocks(value.blocks.map((b) => (b.id === id ? ({ ...b, ...p } as EmailBlock) : b)));
  const addBlock = (type: EmailBlockType) => {
    const nb = newBlock(type);
    setBlocks([...value.blocks, nb]);
    setSelectedId(nb.id);
    setTab("block");
    setShowAdd(false);
  };
  const removeBlock = (id: string) => {
    const blocks = value.blocks.filter((b) => b.id !== id);
    setBlocks(blocks);
    if (selectedId === id) setSelectedId(blocks[0]?.id ?? null);
  };
  const duplicateBlock = (id: string) => {
    const i = value.blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...value.blocks[i], id: newBlock(value.blocks[i].type).id } as EmailBlock;
    const blocks = [...value.blocks];
    blocks.splice(i + 1, 0, copy);
    setBlocks(blocks);
    setSelectedId(copy.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = value.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.blocks.length) return;
    const blocks = [...value.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    setBlocks(blocks);
  };

  const html = useMemo(() => renderEmailHtml(value, SAMPLE_CONTEXT), [value]);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button onClick={onBack} className="btn-ghost h-8 gap-1 px-2 text-sm">← Back</button>
        <input
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-ink outline-none hover:border-line focus:border-brand-600"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <span className="text-xs text-ink-soft">{saved ? "Saved" : "Unsaved"}</span>
        <button onClick={onSave} className="btn-primary h-8 px-3 text-sm">Save template</button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr_300px]">
        {/* left: block list */}
        <div className="min-h-0 overflow-y-auto border-e border-line p-2">
          <div className="space-y-1">
            {value.blocks.map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  setSelectedId(b.id);
                  setTab("block");
                }}
                className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                  selectedId === b.id ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-surface-hover"
                }`}
              >
                <span className="text-sm">{BLOCK_ICON[b.type]}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{BLOCK_LABELS[b.type]}</span>
                <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} className="rounded px-1 text-ink-soft hover:text-ink" aria-label="Up">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} className="rounded px-1 text-ink-soft hover:text-ink" aria-label="Down">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateBlock(b.id); }} className="rounded px-1 text-ink-soft hover:text-ink" aria-label="Duplicate">⧉</button>
                  <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="rounded px-1 text-rose-500 hover:text-rose-600" aria-label="Delete">✕</button>
                </span>
              </div>
            ))}
          </div>

          <div className="relative mt-2">
            <button onClick={() => setShowAdd((s) => !s)} className="btn-outline h-9 w-full text-sm">+ Add block</button>
            {showAdd && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-line bg-surface p-1 shadow-pop">
                {BLOCK_ORDER.map((type) => (
                  <button
                    key={type}
                    onClick={() => addBlock(type)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-ink hover:bg-surface-hover"
                  >
                    <span>{BLOCK_ICON[type]}</span> {BLOCK_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* center: live preview */}
        <div className="min-h-0 overflow-hidden bg-surface-page p-3">
          <iframe title="Email preview" srcDoc={html} className="h-full w-full rounded-xl border border-line bg-white" />
        </div>

        {/* right: inspector / design */}
        <div className="min-h-0 overflow-y-auto border-s border-line">
          <div className="flex border-b border-line text-sm">
            <button onClick={() => setTab("block")} className={`flex-1 py-2 ${tab === "block" ? "border-b-2 border-brand-600 font-semibold text-ink" : "text-ink-muted"}`}>Block</button>
            <button onClick={() => setTab("design")} className={`flex-1 py-2 ${tab === "design" ? "border-b-2 border-brand-600 font-semibold text-ink" : "text-ink-muted"}`}>Email</button>
          </div>

          <div className="p-3">
            {tab === "block" ? (
              selected ? (
                <>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                    <span>{BLOCK_ICON[selected.type]}</span> {BLOCK_LABELS[selected.type]}
                  </div>
                  <Inspector block={selected} patch={(p) => patchBlock(selected.id, p)} />
                  <MergeTagHint />
                </>
              ) : (
                <p className="text-sm text-ink-soft">Select a block on the left to edit it, or add one.</p>
              )
            ) : (
              <DesignPanel value={value} onChange={onChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MergeTagHint() {
  return (
    <div className="mt-4 rounded-xl bg-surface-page p-2.5">
      <div className="mb-1 text-xs font-semibold text-ink-muted">Personalize with merge tags</div>
      <div className="flex flex-wrap gap-1">
        {MERGE_TAGS.map((m) => (
          <code key={m.tag} title={m.label} className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-muted">{m.tag}</code>
        ))}
      </div>
    </div>
  );
}

function DesignPanel({ value, onChange }: { value: EmailTemplate; onChange: (t: EmailTemplate) => void }) {
  const setTheme = (p: Partial<EmailTemplate["theme"]>) => onChange({ ...value, theme: { ...value.theme, ...p } });
  return (
    <div className="space-y-3">
      <Row label="Subject line"><TextField value={value.subject} onChange={(v) => onChange({ ...value, subject: v })} placeholder="What lands in the inbox" /></Row>
      <Row label="Preview text (preheader)"><TextField value={value.preheader} onChange={(v) => onChange({ ...value, preheader: v })} placeholder="The grey line after the subject" /></Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Page background"><ColorField value={value.theme.pageBg} onChange={(v) => setTheme({ pageBg: v })} /></Row>
        <Row label="Email background"><ColorField value={value.theme.cardBg} onChange={(v) => setTheme({ cardBg: v })} /></Row>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Text color"><ColorField value={value.theme.text} onChange={(v) => setTheme({ text: v })} /></Row>
        <Row label="Accent"><ColorField value={value.theme.accent} onChange={(v) => setTheme({ accent: v })} /></Row>
      </div>
      <Row label="Content width (px)"><NumberField value={value.theme.width} onChange={(v) => setTheme({ width: v })} min={480} max={700} /></Row>
    </div>
  );
}
