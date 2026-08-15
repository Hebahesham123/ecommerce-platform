/**
 * Navigation menus — the tree a theme renders as its header drawer, mega menu
 * or footer. Pure types + tree helpers, shared by the admin editor and the
 * storefront renderer.
 */

export type NavItem = {
  id: string;
  title: string;
  /** Storefront path: "/collections/bags", "/products/x", "/cart", … */
  url: string;
  children: NavItem[];
};

export type Menu = {
  id: string;
  handle: string;
  title: string;
  items: NavItem[];
};

/** The editor stops offering "add child" past this depth. */
export const MAX_DEPTH = 3;

/** Flat DB row → tree. Rows may arrive in any order. */
export function buildTree(
  rows: { id: string; parent_id: string | null; title: string; url: string; position: number }[],
): NavItem[] {
  const byId = new Map<string, NavItem>();
  for (const r of rows)
    byId.set(r.id, { id: r.id, title: r.title, url: r.url, children: [] });

  const roots: { item: NavItem; position: number }[] = [];
  const kids = new Map<string, { item: NavItem; position: number }[]>();

  for (const r of rows) {
    const item = byId.get(r.id)!;
    if (r.parent_id && byId.has(r.parent_id)) {
      const list = kids.get(r.parent_id) ?? [];
      list.push({ item, position: r.position });
      kids.set(r.parent_id, list);
    } else {
      roots.push({ item, position: r.position });
    }
  }

  const sortInto = (entries: { item: NavItem; position: number }[]): NavItem[] =>
    entries
      .sort((a, b) => a.position - b.position)
      .map(({ item }) => {
        item.children = sortInto(kids.get(item.id) ?? []);
        return item;
      });

  return sortInto(roots);
}

/** Tree → flat rows ready to insert, with parents before children. */
export function flattenTree(
  items: NavItem[],
  parentId: string | null = null,
): { id: string; parentId: string | null; title: string; url: string; position: number }[] {
  const out: ReturnType<typeof flattenTree> = [];
  items.forEach((item, i) => {
    out.push({ id: item.id, parentId, title: item.title, url: item.url, position: i });
    out.push(...flattenTree(item.children, item.id));
  });
  return out;
}

export function depthOf(items: NavItem[]): number {
  let max = 0;
  const walk = (list: NavItem[], depth: number) => {
    for (const item of list) {
      max = Math.max(max, depth);
      walk(item.children, depth + 1);
    }
  };
  walk(items, 1);
  return max;
}

export function countItems(items: NavItem[]): number {
  return items.reduce((sum, i) => sum + 1 + countItems(i.children), 0);
}

// ---- Immutable tree edits used by the editor --------------------------------
type Mapper = (item: NavItem) => NavItem | null;

function mapTree(items: NavItem[], fn: Mapper): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    const next = fn(item);
    if (!next) continue;
    out.push({ ...next, children: mapTree(next.children, fn) });
  }
  return out;
}

export function updateItem(items: NavItem[], id: string, patch: Partial<NavItem>): NavItem[] {
  return mapTree(items, (item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeItem(items: NavItem[], id: string): NavItem[] {
  return mapTree(items, (item) => (item.id === id ? null : item));
}

export function addChild(items: NavItem[], parentId: string | null, child: NavItem): NavItem[] {
  if (parentId === null) return [...items, child];
  return mapTree(items, (item) =>
    item.id === parentId ? { ...item, children: [...item.children, child] } : item,
  );
}

/** Move an item up or down among its own siblings. */
export function moveItem(items: NavItem[], id: string, delta: number): NavItem[] {
  const reorder = (list: NavItem[]): NavItem[] => {
    const i = list.findIndex((x) => x.id === id);
    if (i !== -1) {
      const target = i + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      const [moved] = next.splice(i, 1);
      next.splice(target, 0, moved);
      return next;
    }
    return list.map((item) => ({ ...item, children: reorder(item.children) }));
  };
  return reorder(items);
}

export function newItem(title = "", url = ""): NavItem {
  return {
    // Client-side id; the server assigns real UUIDs on save.
    id: `new-${Math.random().toString(36).slice(2, 10)}`,
    title,
    url,
    children: [],
  };
}
