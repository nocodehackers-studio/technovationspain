export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === "string") return v.trim() === ""
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length === 0
  return false
}

export type TextFilterMode = { mode: "empty" | "notEmpty" }

export type ActiveFilterValue = string | boolean | TextFilterMode

export function isTextFilterMode(v: unknown): v is TextFilterMode {
  return (
    !!v &&
    typeof v === "object" &&
    "mode" in (v as Record<string, unknown>) &&
    ((v as TextFilterMode).mode === "empty" || (v as TextFilterMode).mode === "notEmpty")
  )
}

export function serializeFilterValue(v: unknown): string {
  if (v && typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export interface ActiveFilter {
  field: string
  label: string
  value: ActiveFilterValue
  displayValue: string
}

export interface FieldOption {
  key: string
  label: string
  type: "select" | "boolean" | "text"
  options?: { value: string; label: string }[]
}
