import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileTypeBadge, ProfileType } from "./ProfileTypeBadge";
import { AlertTriangle, UserCheck, Users, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConflictType = 
  | "duplicate_in_csv" 
  | "already_active" 
  | "already_in_whitelist"
  | "parent_email_match";

export interface ConflictRecord {
  id: string;
  conflictType: ConflictType;
  email: string;
  firstName?: string;
  lastName?: string;
  profileType: ProfileType;
  teamName?: string;
  teamDivision?: string;
  existingData?: {
    firstName?: string;
    lastName?: string;
    matchedProfileId?: string;
  };
  duplicateRows?: number[];
  csvRowIndex: number;
  selected: boolean;
  action: "skip" | "update" | "import";
}

interface ConflictTableProps {
  conflicts: ConflictRecord[];
  onConflictActionChange: (conflictId: string, action: ConflictRecord["action"]) => void;
  onSelectAll: (selected: boolean) => void;
}

const conflictTypeConfig: Record<ConflictType, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  duplicate_in_csv: {
    label: "Duplicado en CSV",
    icon: <FileWarning className="h-4 w-4" />,
    description: "Este email aparece varias veces en el CSV",
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
  },
  already_active: {
    label: "Usuario activo",
    icon: <UserCheck className="h-4 w-4" />,
    description: "Ya está registrado en la plataforma",
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  },
  already_in_whitelist: {
    label: "En whitelist",
    icon: <Users className="h-4 w-4" />,
    description: "Ya existe en la lista de autorizados",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  },
  parent_email_match: {
    label: "Email de tutor",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Este email coincide con el de un tutor",
    color: "text-red-600 bg-red-100 dark:bg-red-900/30",
  },
};

export function ConflictTable({ conflicts, onConflictActionChange, onSelectAll }: ConflictTableProps) {
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);

  const filteredConflicts = showOnlyActionable
    ? conflicts.filter(c => c.conflictType !== "already_active")
    : conflicts;

  const allSkipped = conflicts.every(c => c.action === "skip");
  const someSkipped = conflicts.some(c => c.action === "skip") && !allSkipped;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-skip"
              checked={allSkipped}
              onCheckedChange={(checked) => onSelectAll(!!checked)}
            />
            <label htmlFor="select-all-skip" className="text-sm text-muted-foreground cursor-pointer">
              Ignorar todos
            </label>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {conflicts.length} conflictos en total
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[50px]">Fila</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conflicto</TableHead>
                <TableHead className="w-[120px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConflicts.map((conflict) => {
                const config = conflictTypeConfig[conflict.conflictType];
                const isActiveUser = conflict.conflictType === "already_active";

                return (
                  <TableRow 
                    key={conflict.id}
                    className={cn(
                      isActiveUser && "bg-muted/30"
                    )}
                  >
                    <TableCell className="font-mono text-xs">
                      {conflict.csvRowIndex + 1}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {conflict.email}
                    </TableCell>
                    <TableCell className="text-sm">
                      {conflict.firstName} {conflict.lastName}
                    </TableCell>
                    <TableCell>
                      <ProfileTypeBadge type={conflict.profileType} />
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn("gap-1", config.color)}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isActiveUser ? (
                        <span className="text-xs text-muted-foreground">
                          No modificable
                        </span>
                      ) : (
                        <select
                          value={conflict.action}
                          onChange={(e) => onConflictActionChange(conflict.id, e.target.value as ConflictRecord["action"])}
                          className="w-full text-xs p-1 rounded border bg-background"
                        >
                          <option value="skip">Ignorar</option>
                          <option value="update">Actualizar</option>
                          <option value="import">Importar</option>
                        </select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(conflictTypeConfig).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={cn("p-1 rounded", config.color)}>
              {config.icon}
            </div>
            <span>{config.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
