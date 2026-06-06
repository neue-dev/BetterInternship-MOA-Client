import type {
  IFormBlock,
  IFormMetadata,
  IFormSigningParty,
  IFormSubscriber,
} from "@betterinternship/core/forms";
import { SCHEMA_VERSION } from "@betterinternship/core/forms";
import { normalizeBlocksForSave } from "@/lib/form-schema-normalizer";

// ---- Core delta types ----

export interface BlockImage {
  id: string;
  before: IFormBlock | null;
  after: IFormBlock | null;
}

type MetaSlice = { label: string; name: string; schema_version: number };

export interface Delta {
  blocks: BlockImage[];
  order: { before: string[]; after: string[] } | null;
  meta: { before: MetaSlice; after: MetaSlice } | null;
  parties: { before: IFormSigningParty[]; after: IFormSigningParty[] } | null;
  subscribers: { before: IFormSubscriber[]; after: IFormSubscriber[] } | null;
  mergeKey?: string;
  timestamp?: number;
}

// ---- Diff types (for save modal) ----

export interface FieldDelta {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  children?: FieldDelta[]; // present for accordion groups (e.g. "moved", "resized")
}

export interface BlockChange {
  kind: "added" | "removed" | "modified";
  blockId: string;
  blockType: string;
  label: string;
  partyLabel?: string;
  fieldDeltas?: FieldDelta[];
}

export interface ListChange {
  kind: "added" | "removed" | "modified";
  id: string;
  label: string;
}

export interface FormMetadataDiff {
  metaDeltas: FieldDelta[];
  parties: ListChange[];
  subscribers: ListChange[];
  blocks: BlockChange[];
  reordered: boolean;
  isEmpty: boolean;
}

// ---- Internal helpers ----

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, v) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
        )
      : v
  );
}

function blocksContentEqual(a: IFormBlock, b: IFormBlock): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { order: _ao, ...aRest } = a;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { order: _bo, ...bRest } = b;
  return stableStringify(aRest) === stableStringify(bRest);
}

// Normalizes to the save-boundary form so diffFormMetadata shows net persisted changes.
function normalizeForDiff(metadata: IFormMetadata): IFormMetadata {
  return {
    ...metadata,
    schema_version: SCHEMA_VERSION,
    schema: { ...metadata.schema, blocks: normalizeBlocksForSave(metadata.schema.blocks) },
  };
}

// Shared core: finds all blocks that were added, removed, or had content changes
// (ignoring the `order` field). Used by both computeDelta and diffFormMetadata.
function compareBlocksById(prev: IFormMetadata, next: IFormMetadata): BlockImage[] {
  const prevMap = new Map(prev.schema.blocks.map((b) => [b._id, b]));
  const nextMap = new Map(next.schema.blocks.map((b) => [b._id, b]));
  const allIds = new Set([...prevMap.keys(), ...nextMap.keys()]);

  const images: BlockImage[] = [];
  for (const id of allIds) {
    const before = prevMap.get(id) ?? null;
    const after = nextMap.get(id) ?? null;
    if (before === null || after === null || !blocksContentEqual(before, after)) {
      images.push({ id, before, after });
    }
  }
  return images;
}

// ---- computeDelta ----

export function computeDelta(prev: IFormMetadata, next: IFormMetadata): Delta | null {
  const blocks = compareBlocksById(prev, next);

  const prevIds = prev.schema.blocks.map((b) => b._id);
  const nextIds = next.schema.blocks.map((b) => b._id);
  const orderChanged =
    prevIds.length !== nextIds.length || prevIds.some((id, i) => id !== nextIds[i]);
  const order = orderChanged ? { before: prevIds, after: nextIds } : null;

  const prevMeta: MetaSlice = {
    label: prev.label,
    name: prev.name,
    schema_version: prev.schema_version,
  };
  const nextMeta: MetaSlice = {
    label: next.label,
    name: next.name,
    schema_version: next.schema_version,
  };
  const meta =
    stableStringify(prevMeta) !== stableStringify(nextMeta)
      ? { before: prevMeta, after: nextMeta }
      : null;

  const parties =
    stableStringify(prev.signing_parties) !== stableStringify(next.signing_parties)
      ? { before: prev.signing_parties, after: next.signing_parties }
      : null;

  const prevSubs = prev.subscribers ?? [];
  const nextSubs = next.subscribers ?? [];
  const subscribers =
    stableStringify(prevSubs) !== stableStringify(nextSubs)
      ? { before: prevSubs, after: nextSubs }
      : null;

  if (!blocks.length && !order && !meta && !parties && !subscribers) return null;

  return { blocks, order, meta, parties, subscribers, timestamp: Date.now() };
}

// ---- applyDelta ----

export function applyDelta(
  metadata: IFormMetadata,
  delta: Delta,
  direction: "undo" | "redo"
): IFormMetadata {
  const pick = direction === "undo" ? "before" : "after";

  const map = new Map<string, IFormBlock>(metadata.schema.blocks.map((b) => [b._id, b]));

  for (const image of delta.blocks) {
    if (image[pick] === null) {
      map.delete(image.id);
    } else {
      map.set(image.id, image[pick]!);
    }
  }

  const ids = delta.order
    ? delta.order[pick]
    : metadata.schema.blocks.map((b) => b._id);

  const blocks = ids
    .filter((id) => map.has(id))
    .map((id, i) => ({ ...map.get(id)!, order: i }));

  let result: IFormMetadata = { ...metadata, schema: { ...metadata.schema, blocks } };
  if (delta.meta) result = { ...result, ...delta.meta[pick] };
  if (delta.parties) result = { ...result, signing_parties: delta.parties[pick] };
  if (delta.subscribers) result = { ...result, subscribers: delta.subscribers[pick] };

  return result;
}

// ---- mergeDeltas ----

export function mergeDeltas(a: Delta, b: Delta): Delta {
  const aMap = new Map(a.blocks.map((bi) => [bi.id, bi]));
  const bMap = new Map(b.blocks.map((bi) => [bi.id, bi]));
  const allIds = new Set([...aMap.keys(), ...bMap.keys()]);

  const blocks: BlockImage[] = [];
  for (const id of allIds) {
    const aImg = aMap.get(id);
    const bImg = bMap.get(id);
    if (aImg && bImg) {
      blocks.push({ id, before: aImg.before, after: bImg.after });
    } else {
      blocks.push((aImg ?? bImg)!);
    }
  }

  return {
    blocks,
    order:
      a.order || b.order
        ? { before: (a.order ?? b.order)!.before, after: (b.order ?? a.order)!.after }
        : null,
    meta:
      a.meta || b.meta
        ? { before: (a.meta ?? b.meta)!.before, after: (b.meta ?? a.meta)!.after }
        : null,
    parties:
      a.parties || b.parties
        ? {
            before: (a.parties ?? b.parties)!.before,
            after: (b.parties ?? a.parties)!.after,
          }
        : null,
    subscribers:
      a.subscribers || b.subscribers
        ? {
            before: (a.subscribers ?? b.subscribers)!.before,
            after: (b.subscribers ?? a.subscribers)!.after,
          }
        : null,
    mergeKey: b.mergeKey ?? a.mergeKey,
    timestamp: b.timestamp ?? a.timestamp,
  };
}

// ---- diffFormMetadata ----

function resolveBlockLabel(
  block: IFormBlock,
  allParties: IFormSigningParty[]
): string {
  if (block.block_type === "form_field" || block.block_type === "form_phantom_field") {
    const schema = block.field_schema ?? block.phantom_field_schema;
    return schema?.label || schema?.field || block.block_type;
  }
  if (block.block_type === "header" || block.block_type === "paragraph") {
    const text = (block.text_content ?? "").trim();
    return text.length > 40 ? text.slice(0, 40) + "…" : text || block.block_type;
  }
  return block.block_type;
}

function resolvePartyLabel(
  block: IFormBlock,
  prevParties: IFormSigningParty[],
  nextParties: IFormSigningParty[]
): string | undefined {
  const id = block.signing_party_id;
  if (!id) return undefined;
  return [...prevParties, ...nextParties].find((p) => p._id === id)?.signatory_title;
}

const FRIENDLY_KEYS: Record<string, string> = {
  label: "label",
  field: "field key",
  type: "type",
  x: "x position",
  y: "y position",
  w: "width",
  h: "height",
  page: "page",
  signing_party_id: "assigned party",
  align_h: "horizontal alignment",
  align_v: "vertical alignment",
  size: "font size",
  source: "source",
  shared: "shared",
  prefiller: "prefiller",
  validator: "validator",
  validator_ir: "validator",
  text_content: "text content",
  block_type: "block type",
};

function resolvePartyId(id: unknown, allParties: IFormSigningParty[]): unknown {
  if (typeof id !== "string") return id;
  return allParties.find((p) => p._id === id)?.signatory_title ?? id;
}

const PIXEL_KEYS = new Set(["x", "y", "w", "h"]);
const MOVE_KEYS = new Set(["x", "y"]);
const RESIZE_KEYS = new Set(["w", "h"]);

function formatSchemaValue(key: string, value: unknown): unknown {
  if (typeof value !== "number") return value;
  if (PIXEL_KEYS.has(key)) return `${Math.round(value)}px`;
  if (key === "size") return `${Math.round(value)}pt`;
  if (key === "page") return Math.round(value);
  return value;
}

function getSchemaDeltas(
  bSchema: Record<string, unknown>,
  aSchema: Record<string, unknown>,
  allParties: IFormSigningParty[]
): FieldDelta[] {
  const subSkip = new Set(["_id", "order"]);
  const subKeys = new Set([...Object.keys(bSchema), ...Object.keys(aSchema)]);

  const raw: FieldDelta[] = [];
  for (const subKey of subKeys) {
    if (subSkip.has(subKey)) continue;
    const sbVal = bSchema[subKey];
    const saVal = aSchema[subKey];
    if (stableStringify(sbVal) !== stableStringify(saVal)) {
      const before =
        subKey === "signing_party_id"
          ? resolvePartyId(sbVal, allParties)
          : formatSchemaValue(subKey, sbVal);
      const after =
        subKey === "signing_party_id"
          ? resolvePartyId(saVal, allParties)
          : formatSchemaValue(subKey, saVal);
      raw.push({ key: subKey, label: FRIENDLY_KEYS[subKey] ?? subKey, before, after });
    }
  }

  // Group x/y → "moved", w/h → "resized" accordion entries
  const moveDeltas = raw.filter((d) => MOVE_KEYS.has(d.key));
  const resizeDeltas = raw.filter((d) => RESIZE_KEYS.has(d.key));
  const rest = raw.filter((d) => !MOVE_KEYS.has(d.key) && !RESIZE_KEYS.has(d.key));

  const result: FieldDelta[] = [];
  if (moveDeltas.length > 0)
    result.push({ key: "_moved", label: "moved", before: null, after: null, children: moveDeltas });
  if (resizeDeltas.length > 0)
    result.push({ key: "_resized", label: "resized", before: null, after: null, children: resizeDeltas });
  result.push(...rest);
  return result;
}

function getFieldDeltas(
  before: IFormBlock,
  after: IFormBlock,
  allParties: IFormSigningParty[]
): FieldDelta[] {
  const skip = new Set(["_id", "order"]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const deltas: FieldDelta[] = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const bVal = (before as Record<string, unknown>)[key];
    const aVal = (after as Record<string, unknown>)[key];
    if (stableStringify(bVal) !== stableStringify(aVal)) {
      if (
        (key === "field_schema" || key === "phantom_field_schema") &&
        bVal != null &&
        aVal != null
      ) {
        deltas.push(
          ...getSchemaDeltas(
            bVal as Record<string, unknown>,
            aVal as Record<string, unknown>,
            allParties
          )
        );
      } else {
        const resolvedBefore =
          key === "signing_party_id" ? resolvePartyId(bVal, allParties) : bVal;
        const resolvedAfter =
          key === "signing_party_id" ? resolvePartyId(aVal, allParties) : aVal;
        deltas.push({ key, label: FRIENDLY_KEYS[key] ?? key, before: resolvedBefore, after: resolvedAfter });
      }
    }
  }
  return deltas;
}

export function diffFormMetadata(
  baseline: IFormMetadata,
  current: IFormMetadata
): FormMetadataDiff {
  const prev = normalizeForDiff(baseline);
  const next = normalizeForDiff(current);

  // Meta
  const metaDeltas: FieldDelta[] = [];
  for (const key of ["label", "name", "schema_version"] as const) {
    if (prev[key] !== next[key]) {
      metaDeltas.push({
        key,
        label: FRIENDLY_KEYS[key] ?? key,
        before: prev[key],
        after: next[key],
      });
    }
  }

  // Parties
  const prevPartiesMap = new Map(prev.signing_parties.map((p) => [p._id, p]));
  const nextPartiesMap = new Map(next.signing_parties.map((p) => [p._id, p]));
  const allPartyIds = new Set([...prevPartiesMap.keys(), ...nextPartiesMap.keys()]);
  const parties: ListChange[] = [];
  for (const id of allPartyIds) {
    const pp = prevPartiesMap.get(id);
    const np = nextPartiesMap.get(id);
    if (!pp) parties.push({ kind: "added", id, label: np!.signatory_title });
    else if (!np) parties.push({ kind: "removed", id, label: pp.signatory_title });
    else if (stableStringify(pp) !== stableStringify(np))
      parties.push({ kind: "modified", id, label: np.signatory_title });
  }

  // Subscribers
  const prevEmails = new Set((prev.subscribers ?? []).map((s) => s.email));
  const nextEmails = new Set((next.subscribers ?? []).map((s) => s.email));
  const subscribers: ListChange[] = [];
  for (const email of new Set([...prevEmails, ...nextEmails])) {
    if (!prevEmails.has(email)) subscribers.push({ kind: "added", id: email, label: email });
    else if (!nextEmails.has(email))
      subscribers.push({ kind: "removed", id: email, label: email });
  }

  // Blocks
  const blockImages = compareBlocksById(prev, next);
  const allParties = [...prev.signing_parties, ...next.signing_parties];
  const blocks: BlockChange[] = blockImages.map((image) => {
    if (image.before === null) {
      return {
        kind: "added",
        blockId: image.id,
        blockType: image.after!.block_type,
        label: resolveBlockLabel(image.after!, allParties),
        partyLabel: resolvePartyLabel(image.after!, prev.signing_parties, next.signing_parties),
      };
    }
    if (image.after === null) {
      return {
        kind: "removed",
        blockId: image.id,
        blockType: image.before.block_type,
        label: resolveBlockLabel(image.before, allParties),
        partyLabel: resolvePartyLabel(image.before, prev.signing_parties, next.signing_parties),
      };
    }
    return {
      kind: "modified",
      blockId: image.id,
      blockType: image.after.block_type,
      label: resolveBlockLabel(image.after, allParties),
      partyLabel: resolvePartyLabel(image.after, prev.signing_parties, next.signing_parties),
      fieldDeltas: getFieldDeltas(image.before, image.after, allParties),
    };
  });

  // Reordered: check surviving blocks only
  const addedOrRemovedIds = new Set(
    blockImages.filter((bi) => bi.before === null || bi.after === null).map((bi) => bi.id)
  );
  const survivorsPrev = prev.schema.blocks.map((b) => b._id).filter((id) => !addedOrRemovedIds.has(id));
  const survivorsNext = next.schema.blocks.map((b) => b._id).filter((id) => !addedOrRemovedIds.has(id));
  const reordered = survivorsPrev.some((id, i) => id !== survivorsNext[i]);

  const isEmpty =
    metaDeltas.length === 0 &&
    parties.length === 0 &&
    subscribers.length === 0 &&
    blocks.length === 0 &&
    !reordered;

  return { metaDeltas, parties, subscribers, blocks, reordered, isEmpty };
}
