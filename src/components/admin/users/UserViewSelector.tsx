import { Button } from "@/components/ui/button"
import type { ViewConfig } from "./viewDefinitions"

interface UserViewSelectorProps {
  views: ViewConfig[]
  activeViewId: string
  onViewChange: (id: string) => void
}

export function UserViewSelector({ views, activeViewId, onViewChange }: UserViewSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => {
        const Icon = view.icon
        const isActive = view.id === activeViewId
        return (
          <Button
            key={view.id}
            variant={isActive ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => onViewChange(view.id)}
          >
            <Icon className="h-4 w-4" />
            {view.label}
          </Button>
        )
      })}
    </div>
  )
}
