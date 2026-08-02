import { z } from "zod";
import type { VisualElementSelection } from "./types";

export const VISUAL_EDIT_SOURCE = "cognix-visual-edit";
export const VISUAL_EDIT_VERSION = 1;
export const MAX_VISUAL_SELECTIONS = 5;

const shortText = z.string().max(600);
const coordinate = z.number().finite().min(-10_000_000).max(10_000_000);

const sourceSchema = z
  .object({
    file: z.string().min(1).max(400),
    line: z.number().int().positive().max(10_000_000).optional(),
    column: z.number().int().nonnegative().max(10_000).optional(),
  })
  .strict();

const componentSchema = z
  .object({
    name: z.string().min(1).max(160),
    source: sourceSchema.optional(),
  })
  .strict();

const attributesSchema = z
  .record(z.string().min(1).max(40), shortText)
  .refine((value) => Object.keys(value).length <= 12, "Too many element attributes");

export const visualElementSelectionSchema = z
  .object({
    id: z.string().min(1).max(2_600),
    route: z.string().min(1).max(400).refine((value) => value.startsWith("/") && !/[?#]/.test(value), "Route must be a pathname"),
    selector: z.string().min(1).max(2_000),
    tagName: z.string().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z0-9-]*$/),
    role: z.string().max(100).optional(),
    accessibleName: z.string().max(300).optional(),
    text: z.string().max(300).optional(),
    attributes: attributesSchema,
    rect: z
      .object({ x: coordinate, y: coordinate, width: coordinate, height: coordinate })
      .strict(),
    viewport: z
      .object({ width: z.number().int().positive().max(20_000), height: z.number().int().positive().max(20_000) })
      .strict(),
    styles: z
      .object({
        display: shortText.optional(),
        position: shortText.optional(),
        color: shortText.optional(),
        backgroundColor: shortText.optional(),
        fontSize: shortText.optional(),
        fontWeight: shortText.optional(),
        borderRadius: shortText.optional(),
      })
      .strict()
      .optional(),
    componentStack: z.array(componentSchema).max(8).optional(),
  })
  .strict();

export const visualSelectionsSchema = z
  .array(visualElementSelectionSchema)
  .max(MAX_VISUAL_SELECTIONS)
  .refine((value) => JSON.stringify(value).length <= 40_000, "Visual selection context is too large");

export function parseVisualSelections(value: unknown): VisualElementSelection[] {
  const parsed = visualSelectionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function applyVisualSelection(
  current: VisualElementSelection[],
  next: VisualElementSelection,
  append: boolean,
): VisualElementSelection[] {
  if (!append) return [next];
  const withoutDuplicate = current.filter((item) => item.id !== next.id);
  return [...withoutDuplicate, next].slice(-MAX_VISUAL_SELECTIONS);
}

export function visualSelectionLabel(selection: VisualElementSelection) {
  const component = selection.componentStack?.[0]?.name;
  return component || selection.accessibleName || `<${selection.tagName}>`;
}
