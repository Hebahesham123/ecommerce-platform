/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reads a theme's `{% schema %}` blocks and template JSON to work out every
 * place the merchant can point a link — section settings, block settings and
 * global theme settings.
 *
 * Pure (no database, no `server-only`) so the admin client can share the types
 * and the renderer can reuse the same parsing and override keys.
 */

export type FileMap = Record<string, string>;

/** Setting types we expose in the customizer. Everything else is left alone. */
export const LINKABLE_TYPES = [
  "url",
  "collection",
  "product",
  "collection_list",
  "product_list",
] as const;

export type LinkableType = (typeof LINKABLE_TYPES)[number];
/** `text` is included only for button captions, so a link can be renamed. */
export type EditableType = LinkableType | "text";

export type SettingDef = {
  id: string;
  type: EditableType;
  label: string;
  info?: string;
  default: unknown;
};

export type BlockDef = {
  id: string;
  type: string;
  label: string;
  settings: SettingDef[];
  values: Record<string, unknown>;
};

export type SectionDef = {
  /** Stable override key: "<scope>::<instanceId>". */
  key: string;
  scope: string;
  instanceId: string;
  type: string;
  name: string;
  settings: SettingDef[];
  values: Record<string, unknown>;
  blocks: BlockDef[];
};

export type ThemeMap = {
  global: { settings: SettingDef[]; values: Record<string, unknown> };
  sections: SectionDef[];
  /** Template names the theme actually ships, for the preview switcher. */
  templates: string[];
};

/** One stored override set for a single section instance. */
export type SectionOverride = {
  settings?: Record<string, unknown>;
  blocks?: Record<string, Record<string, unknown>>;
};

export type LinkOverride = { from: string; to: string; label?: string };

export type ThemeCustomization = {
  settings: Record<string, unknown>;
  sections: Record<string, SectionOverride>;
  links: LinkOverride[];
};

export const EMPTY_CUSTOMIZATION: ThemeCustomization = {
  settings: {},
  sections: {},
  links: [],
};

export function sectionKey(scope: string, instanceId: string): string {
  return `${scope}::${instanceId}`;
}

// ---- Schema parsing ---------------------------------------------------------
export function tryJSON<T = any>(txt: string | undefined): T | null {
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

/** A text setting only counts as editable when it reads like a button caption. */
const BUTTON_TEXT_RE = /(label|button|cta|link_text|btn)/i;

function toSettingDef(s: any): SettingDef | null {
  if (!s?.id) return null;
  const type = String(s.type ?? "");
  if ((LINKABLE_TYPES as readonly string[]).includes(type))
    return {
      id: String(s.id),
      type: type as LinkableType,
      label: String(s.label ?? s.id),
      info: s.info ? String(s.info) : undefined,
      default: s.default ?? "",
    };
  if (type === "text" && BUTTON_TEXT_RE.test(String(s.id)))
    return {
      id: String(s.id),
      type: "text",
      label: String(s.label ?? s.id),
      info: s.info ? String(s.info) : undefined,
      default: s.default ?? "",
    };
  return null;
}

export type ParsedSchema = {
  name: string;
  /** Editable (linkable) settings only. */
  settings: SettingDef[];
  /** Defaults for EVERY setting, so rendering keeps its current behaviour. */
  allDefaults: Record<string, unknown>;
  blockTypes: Record<string, { name: string; settings: SettingDef[]; defaults: Record<string, unknown> }>;
  presetBlocks: { type: string; settings: Record<string, unknown> }[];
};

/** Parse the `{% schema %}` block out of a section's Liquid source. */
export function parseSectionSchema(src: string): ParsedSchema {
  const empty: ParsedSchema = {
    name: "",
    settings: [],
    allDefaults: {},
    blockTypes: {},
    presetBlocks: [],
  };
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!m) return empty;
  const schema = tryJSON<any>(m[1]);
  if (!schema) return empty;

  const out: ParsedSchema = { ...empty, name: String(schema.name ?? ""), settings: [], allDefaults: {}, blockTypes: {}, presetBlocks: [] };

  for (const s of schema.settings ?? []) {
    if (!s?.id) continue;
    out.allDefaults[s.id] = s.default ?? "";
    const def = toSettingDef(s);
    if (def) out.settings.push(def);
  }

  for (const b of schema.blocks ?? []) {
    if (!b?.type) continue;
    const defaults: Record<string, unknown> = {};
    const settings: SettingDef[] = [];
    for (const s of b.settings ?? []) {
      if (!s?.id) continue;
      defaults[s.id] = s.default ?? "";
      const def = toSettingDef(s);
      if (def) settings.push(def);
    }
    out.blockTypes[b.type] = { name: String(b.name ?? b.type), settings, defaults };
  }

  const preset = Array.isArray(schema.presets) ? schema.presets[0] : null;
  for (const b of preset?.blocks ?? []) {
    if (!b?.type) continue;
    out.presetBlocks.push({
      type: b.type,
      settings: { ...(out.blockTypes[b.type]?.defaults ?? {}), ...(b.settings ?? {}) },
    });
  }
  return out;
}

// ---- Where section instances live -------------------------------------------
export type SectionInstance = {
  scope: string;
  instanceId: string;
  type: string;
  settings: Record<string, unknown>;
  blocks: Record<string, { type: string; settings: Record<string, unknown> }>;
  blockOrder: string[];
  disabled?: boolean;
};

function instancesFromJson(scope: string, json: any): SectionInstance[] {
  if (!json?.order) return [];
  const out: SectionInstance[] = [];
  for (const id of json.order) {
    const inst = json.sections?.[id];
    if (!inst?.type) continue;
    const blocks: SectionInstance["blocks"] = {};
    for (const [bid, b] of Object.entries<any>(inst.blocks ?? {}))
      blocks[bid] = { type: String(b?.type ?? ""), settings: b?.settings ?? {} };
    out.push({
      scope,
      instanceId: String(id),
      type: String(inst.type),
      settings: inst.settings ?? {},
      blocks,
      blockOrder: inst.block_order ?? Object.keys(inst.blocks ?? {}),
      disabled: Boolean(inst.disabled),
    });
  }
  return out;
}

/**
 * Every section instance the theme renders: template JSON files, section
 * groups, and bare `{% section 'x' %}` tags in the layout.
 */
export function collectSectionInstances(files: FileMap): SectionInstance[] {
  const out: SectionInstance[] = [];

  for (const path of Object.keys(files)) {
    const tpl = path.match(/^templates\/([\w.-]+)\.json$/);
    if (tpl) out.push(...instancesFromJson(`templates/${tpl[1]}`, tryJSON(files[path])));
    const grp = path.match(/^sections\/([\w.-]+)\.json$/);
    if (grp) out.push(...instancesFromJson(`sections/${grp[1]}`, tryJSON(files[path])));
  }

  // Bare {% section 'name' %} in the layout has no JSON instance of its own.
  const layout = files["layout/theme.liquid"] ?? "";
  const seen = new Set(out.map((i) => `${i.scope}::${i.instanceId}`));
  for (const m of layout.matchAll(/\{%-?\s*section\s+['"]([\w.-]+)['"]\s*-?%\}/g)) {
    const type = m[1];
    const key = `layout::${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      scope: "layout",
      instanceId: type,
      type,
      settings: {},
      blocks: {},
      blockOrder: [],
    });
  }
  return out;
}

// ---- The customizer's view of a theme ---------------------------------------
function globalDefs(files: FileMap): { settings: SettingDef[]; defaults: Record<string, unknown> } {
  const schema = tryJSON<any[]>(files["config/settings_schema.json"]);
  const settings: SettingDef[] = [];
  const defaults: Record<string, unknown> = {};
  if (Array.isArray(schema))
    for (const panel of schema)
      for (const s of panel?.settings ?? []) {
        if (!s?.id) continue;
        defaults[s.id] = s.default ?? "";
        const def = toSettingDef(s);
        if (def) settings.push({ ...def, label: `${panel?.name ? `${panel.name} · ` : ""}${def.label}` });
      }
  return { settings, defaults };
}

/** Values saved in config/settings_data.json (the theme author's own choices). */
export function themeSettingsData(files: FileMap): Record<string, unknown> {
  const data = tryJSON<any>(files["config/settings_data.json"]);
  let current: any = data?.current;
  if (typeof current === "string") current = data?.presets?.[current] ?? {};
  return (current ?? {}) as Record<string, unknown>;
}

/**
 * Build the full editable map of a theme, with each setting's *effective*
 * value: schema default → theme's saved value → merchant override.
 */
export function buildThemeMap(
  files: FileMap,
  customization: ThemeCustomization = EMPTY_CUSTOMIZATION,
): ThemeMap {
  const g = globalDefs(files);
  const globalValues: Record<string, unknown> = {
    ...g.defaults,
    ...themeSettingsData(files),
    ...customization.settings,
  };

  const sections: SectionDef[] = [];
  for (const inst of collectSectionInstances(files)) {
    const src = files[`sections/${inst.type}.liquid`];
    if (!src) continue;
    const schema = parseSectionSchema(src);
    const key = sectionKey(inst.scope, inst.instanceId);
    const override = customization.sections[key] ?? {};

    const values: Record<string, unknown> = {
      ...schema.allDefaults,
      ...inst.settings,
      ...(override.settings ?? {}),
    };

    // Saved blocks, or the schema preset when the theme ships none.
    const order = inst.blockOrder.length
      ? inst.blockOrder
      : schema.presetBlocks.map((_, i) => `${inst.instanceId}-${i}`);
    const blocks: BlockDef[] = order.map((bid, i) => {
      const saved = inst.blocks[bid];
      const type = saved?.type ?? schema.presetBlocks[i]?.type ?? "";
      const def = schema.blockTypes[type];
      return {
        id: bid,
        type,
        label: def?.name ?? type ?? "Block",
        settings: def?.settings ?? [],
        values: {
          ...(def?.defaults ?? {}),
          ...(schema.presetBlocks[i]?.settings ?? {}),
          ...(saved?.settings ?? {}),
          ...(override.blocks?.[bid] ?? {}),
        },
      };
    });

    sections.push({
      key,
      scope: inst.scope,
      instanceId: inst.instanceId,
      type: inst.type,
      name: schema.name || inst.type,
      settings: schema.settings,
      values,
      blocks: blocks.filter((b) => b.settings.length > 0 || b.type),
    });
  }

  const templates = Object.keys(files)
    .map((p) => p.match(/^templates\/([\w.-]+)\.(json|liquid)$/)?.[1])
    .filter((n): n is string => Boolean(n));

  return {
    global: { settings: g.settings, values: globalValues },
    sections,
    templates: [...new Set(templates)].sort(),
  };
}

/** True when the theme exposes nothing schema-driven to re-point. */
export function hasEditableSettings(map: ThemeMap): boolean {
  return (
    map.global.settings.length > 0 ||
    map.sections.some((s) => s.settings.length > 0 || s.blocks.some((b) => b.settings.length > 0))
  );
}

// ---- Hardcoded links --------------------------------------------------------
export type FoundLink = {
  href: string;
  label: string;
  count: number;
};

const SKIP_HREF_RE = /^(#|javascript:|mailto:|tel:|data:)/i;

/**
 * Pull the anchors out of rendered (pre-URL-rewrite) HTML so the customizer can
 * offer to re-point buttons the theme hardcodes instead of exposing as settings.
 */
export function scanLinks(html: string): FoundLink[] {
  const found = new Map<string, FoundLink>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = (m[1] ?? m[2] ?? "").trim();
    if (!href || SKIP_HREF_RE.test(href)) continue;
    // External destinations are the merchant's own business — leave them out.
    if (/^(https?:)?\/\//i.test(href)) continue;
    const label = m[3]
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    const hit = found.get(href);
    if (hit) {
      hit.count++;
      if (!hit.label && label) hit.label = label;
    } else {
      found.set(href, { href, label, count: 1 });
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.href.localeCompare(b.href));
}

/** Apply the merchant's link rewrites to raw theme hrefs. */
export function applyLinkOverrides(html: string, links: LinkOverride[]): string {
  if (!links.length) return html;
  const map = new Map(links.filter((l) => l.from && l.to).map((l) => [l.from, l.to]));
  if (!map.size) return html;
  return html.replace(
    /(\bhref\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi,
    (whole, attr: string, dq?: string, sq?: string) => {
      const val = dq !== undefined ? dq : (sq ?? "");
      const next = map.get(val.trim());
      return next ? `${attr}"${next.replace(/"/g, "&quot;")}"` : whole;
    },
  );
}
