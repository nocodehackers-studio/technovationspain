import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Team } from '@/types/database';
import { cn } from '@/lib/utils';

interface TeamComboboxProps {
  teams: Team[];
  value: string | null;
  onSelect: (team: Team) => void;
  excludeIds?: string[];
  placeholder?: string;
  buttonClassName?: string;
}

export function TeamCombobox({
  teams,
  value,
  onSelect,
  excludeIds,
  placeholder = 'Asignar equipo...',
  buttonClassName,
}: TeamComboboxProps) {
  const [open, setOpen] = useState(false);

  const visibleTeams = useMemo(() => {
    if (!excludeIds || excludeIds.length === 0) return teams;
    const set = new Set(excludeIds);
    return teams.filter((t) => !set.has(t.id) || t.id === value);
  }, [teams, excludeIds, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('w-full justify-between text-xs', buttonClassName)}
        >
          {value
            ? teams.find((t) => t.id === value)?.name ?? 'Seleccionar...'
            : placeholder}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar equipo..." />
          <CommandList>
            <CommandEmpty>No encontrado</CommandEmpty>
            <CommandGroup>
              {visibleTeams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => {
                    onSelect(team);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === team.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {team.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
