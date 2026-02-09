import { UseFormReturn } from 'react-hook-form';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CompanionData {
  first_name: string;
  last_name: string;
  dni: string;
  relationship: string;
}

interface CompanionFieldsProps {
  form: UseFormReturn<any>;
  maxCompanions: number;
  companions: CompanionData[];
  requiredFields: string[];
  onAddCompanion: () => void;
  onRemoveCompanion: (index: number) => void;
  onUpdateCompanion: (index: number, field: keyof CompanionData, value: string) => void;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'mother', label: 'Madre' },
  { value: 'father', label: 'Padre' },
  { value: 'guardian', label: 'Tutor/a legal' },
  { value: 'grandparent', label: 'Abuelo/a' },
  { value: 'sibling', label: 'Hermano/a' },
  { value: 'other', label: 'Otro familiar' },
];

export function CompanionFields({
  maxCompanions,
  companions,
  requiredFields,
  onAddCompanion,
  onRemoveCompanion,
  onUpdateCompanion,
}: CompanionFieldsProps) {
  if (maxCompanions === 0) return null;

  const isAnonymous = requiredFields.length === 0;

  // Anonymous companions - simplified UI
  if (isAnonymous) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Acompañantes
          </CardTitle>
          <CardDescription>
            Puedes añadir hasta {maxCompanions} acompañante{maxCompanions > 1 ? 's' : ''} para este evento. 
            Cada acompañante recibirá su propia entrada con código QR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="font-medium">Entradas de acompañante</p>
              <p className="text-sm text-muted-foreground">
                {companions.length} de {maxCompanions} seleccionadas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onRemoveCompanion(companions.length - 1)}
                disabled={companions.length === 0}
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium">{companions.length}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onAddCompanion}
                disabled={companions.length >= maxCompanions}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {companions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              No has añadido ningún acompañante. Los acompañantes son opcionales.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Standard companions with configurable fields
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Acompañantes
        </CardTitle>
        <CardDescription>
          Puedes registrar hasta {maxCompanions} acompañante{maxCompanions > 1 ? 's' : ''} para este evento. 
          Cada acompañante recibirá su propia entrada con código QR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {companions.map((companion, index) => (
          <div key={index} className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm">Acompañante {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveCompanion(index)}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiredFields.includes('first_name') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input
                    placeholder="Nombre del acompañante"
                    value={companion.first_name}
                    onChange={(e) => onUpdateCompanion(index, 'first_name', e.target.value)}
                  />
                </div>
              )}
              
              {requiredFields.includes('last_name') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Apellidos *</label>
                  <Input
                    placeholder="Apellidos del acompañante"
                    value={companion.last_name}
                    onChange={(e) => onUpdateCompanion(index, 'last_name', e.target.value)}
                  />
                </div>
              )}
            </div>
            
            {requiredFields.includes('dni') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">DNI/NIE *</label>
                <Input
                  placeholder="Documento de identidad"
                  value={companion.dni}
                  onChange={(e) => onUpdateCompanion(index, 'dni', e.target.value)}
                />
              </div>
            )}
            
            {requiredFields.includes('relationship') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Parentesco *</label>
                <Select
                  value={companion.relationship}
                  onValueChange={(value) => onUpdateCompanion(index, 'relationship', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el parentesco" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ))}
        
        {companions.length < maxCompanions && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onAddCompanion}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Añadir acompañante
          </Button>
        )}
        
        {companions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No has añadido ningún acompañante. Los acompañantes son opcionales.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
