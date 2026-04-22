import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, X, Lock } from "lucide-react"
import {
  isTextFilterMode,
  serializeFilterValue,
  type ActiveFilter,
  type ActiveFilterValue,
  type FieldOption,
} from "./filterHelpers"

interface DynamicFilterBarProps {
  filters: ActiveFilter[]
  viewPresetFilters: ActiveFilter[]
  availableFields: FieldOption[]
  onAddFilter: (filter: ActiveFilter) => void
  onRemoveFilter: (field: string, value: ActiveFilterValue) => void
  onRemovePresetFilter: (field: string) => void
}

type TextMode = "contains" | "empty" | "notEmpty"

export function DynamicFilterBar({
  filters,
  viewPresetFilters,
  availableFields,
  onAddFilter,
  onRemoveFilter,
  onRemovePresetFilter,
}: DynamicFilterBarProps) {
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false)
  const [selectedField, setSelectedField] = useState<FieldOption | null>(null)
  const [textValue, setTextValue] = useState("")
  const [fieldSearch, setFieldSearch] = useState("")
  const [textMode, setTextMode] = useState<TextMode>("contains")

  const resetState = () => {
    setSelectedField(null)
    setTextValue("")
    setTextMode("contains")
  }

  const handleSelectField = (field: FieldOption) => {
    if (field.type === "text") {
      setSelectedField(field)
      setTextValue("")
      setTextMode("contains")
    } else {
      setSelectedField(field)
    }
  }

  const handleAddSelectValue = (field: FieldOption, value: string, displayLabel: string) => {
    onAddFilter({
      field: field.key,
      label: field.label,
      value,
      displayValue: displayLabel,
    })
  }

  const handleAddBooleanValue = (field: FieldOption, val: boolean) => {
    onAddFilter({
      field: field.key,
      label: field.label,
      value: val,
      displayValue: val ? "Sí" : "No",
    })
    resetState()
    setFieldPickerOpen(false)
  }

  const handleAddTextValue = () => {
    if (!selectedField || !textValue.trim()) return
    onAddFilter({
      field: selectedField.key,
      label: selectedField.label,
      value: textValue.trim(),
      displayValue: textValue.trim(),
    })
    resetState()
    setFieldPickerOpen(false)
  }

  const handleAddEmptinessMode = (mode: "empty" | "notEmpty") => {
    if (!selectedField) return
    const displayValue = mode === "empty" ? "Vacío" : "No vacío"
    onAddFilter({
      field: selectedField.key,
      label: selectedField.label,
      value: { mode },
      displayValue,
    })
    resetState()
    setFieldPickerOpen(false)
  }

  const handleBack = () => {
    resetState()
  }

  const filteredFields = availableFields.filter((f) =>
    f.label.toLowerCase().includes(fieldSearch.toLowerCase())
  )

  const hasEmptyFilter = selectedField
    ? filters.some(
        (f) =>
          f.field === selectedField.key &&
          isTextFilterMode(f.value) &&
          f.value.mode === "empty"
      )
    : false

  const hasNotEmptyFilter = selectedField
    ? filters.some(
        (f) =>
          f.field === selectedField.key &&
          isTextFilterMode(f.value) &&
          f.value.mode === "notEmpty"
      )
    : false

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* View preset filter tags */}
      {viewPresetFilters.map((f) => (
        <div
          key={`preset-${f.field}-${serializeFilterValue(f.value)}`}
          className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs sm:text-sm"
        >
          <Lock className="h-3 w-3 opacity-50" />
          <span className="truncate max-w-[150px] sm:max-w-none">
            {f.label}: {f.displayValue}
          </span>
          <button
            onClick={() => onRemovePresetFilter(f.field)}
            className="ml-1 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* User-added filter tags */}
      {filters.map((f) => (
        <div
          key={`filter-${f.field}-${serializeFilterValue(f.value)}`}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs sm:text-sm"
        >
          <span className="truncate max-w-[150px] sm:max-w-none">
            {f.label}: {f.displayValue}
          </span>
          <button
            onClick={() => onRemoveFilter(f.field, f.value)}
            className="ml-1 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Add filter button */}
      <Popover open={fieldPickerOpen} onOpenChange={(open) => {
        setFieldPickerOpen(open)
        if (!open) {
          resetState()
          setFieldSearch("")
        }
      }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Añadir filtro
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          {!selectedField ? (
            <div className="space-y-1">
              <Input
                placeholder="Buscar campo..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="h-8 mb-1"
              />
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {filteredFields.map((field) => (
                  <button
                    key={field.key}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                    onClick={() => handleSelectField(field)}
                  >
                    {field.label}
                  </button>
                ))}
                {filteredFields.length === 0 && (
                  <p className="text-sm text-muted-foreground px-2 py-1.5">Sin resultados</p>
                )}
              </div>
            </div>
          ) : selectedField.type === "select" ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1 mb-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleBack}>
                  ←
                </Button>
                <span className="text-sm font-medium">{selectedField.label}</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {(selectedField.options || []).map((opt) => {
                  const isActive = filters.some(
                    (f) => f.field === selectedField.key && String(f.value) === String(opt.value)
                  )
                  return (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={isActive}
                        onCheckedChange={() => {
                          if (isActive) {
                            onRemoveFilter(selectedField.key, opt.value)
                          } else {
                            handleAddSelectValue(selectedField, opt.value, opt.label)
                          }
                        }}
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : selectedField.type === "boolean" ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1 mb-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleBack}>
                  ←
                </Button>
                <span className="text-sm font-medium">{selectedField.label}</span>
              </div>
              <button
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                onClick={() => handleAddBooleanValue(selectedField, true)}
              >
                Sí
              </button>
              <button
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm"
                onClick={() => handleAddBooleanValue(selectedField, false)}
              >
                No
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1 mb-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleBack}>
                  ←
                </Button>
                <span className="text-sm font-medium">{selectedField.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Button
                  size="sm"
                  variant={textMode === "contains" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setTextMode("contains")}
                >
                  Contiene
                </Button>
                <Button
                  size="sm"
                  variant={textMode === "empty" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setTextMode("empty")}
                >
                  Vacío
                </Button>
                <Button
                  size="sm"
                  variant={textMode === "notEmpty" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setTextMode("notEmpty")}
                >
                  No vacío
                </Button>
              </div>
              {textMode === "contains" ? (
                <>
                  <Input
                    placeholder={`Filtrar por ${selectedField.label.toLowerCase()}...`}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTextValue()
                    }}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="sm" className="w-full" onClick={handleAddTextValue} disabled={!textValue.trim()}>
                    Aplicar
                  </Button>
                </>
              ) : textMode === "empty" ? (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleAddEmptinessMode("empty")}
                  disabled={hasEmptyFilter}
                >
                  {hasEmptyFilter ? "Ya añadido" : "Añadir filtro \"Vacío\""}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleAddEmptinessMode("notEmpty")}
                  disabled={hasNotEmptyFilter}
                >
                  {hasNotEmptyFilter ? "Ya añadido" : "Añadir filtro \"No vacío\""}
                </Button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
