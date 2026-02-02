import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Building2, ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Hub } from "@/types/database";

interface HubLinkSectionProps {
  userId: string;
  currentHubId?: string | null;
  currentHubName?: string | null;
}

export function HubLinkSection({
  userId,
  currentHubId,
  currentHubName,
}: HubLinkSectionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);

  // Fetch all hubs for selection
  const { data: hubs } = useQuery({
    queryKey: ["admin-hubs-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hubs")
        .select("id, name, location")
        .order("name");
      if (error) throw error;
      return data as Hub[];
    },
  });

  // Reset selected hub when user changes
  useEffect(() => {
    setSelectedHub(null);
  }, [userId]);

  // Link user to hub mutation
  const linkToHubMutation = useMutation({
    mutationFn: async (hubId: string | null) => {
      const { error } = await supabase
        .from("profiles")
        .update({ hub_id: hubId })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(selectedHub ? "Usuario vinculado al hub" : "Usuario desvinculado del hub");
      setSelectedHub(null);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleLink = () => {
    if (!selectedHub) return;
    linkToHubMutation.mutate(selectedHub.id);
  };

  const handleUnlink = () => {
    linkToHubMutation.mutate(null);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        Hub
      </h3>

      {/* Current hub info */}
      {currentHubName && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <span className="text-sm font-medium">{currentHubName}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleUnlink}
            disabled={linkToHubMutation.isPending}
          >
            <X className="h-4 w-4 mr-1" />
            Desvincular
          </Button>
        </div>
      )}

      {/* Hub selector */}
      <div className="space-y-3">
        <Label>{currentHubName ? "Cambiar a otro hub" : "Vincular a hub"}</Label>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedHub ? selectedHub.name : "Buscar hub..."}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar hub..." />
              <CommandList>
                <CommandEmpty>No se encontraron hubs</CommandEmpty>
                <CommandGroup>
                  {hubs?.map((hub) => (
                    <CommandItem
                      key={hub.id}
                      value={hub.name}
                      onSelect={() => {
                        setSelectedHub(hub);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedHub?.id === hub.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{hub.name}</span>
                        {hub.location && (
                          <span className="text-xs text-muted-foreground">
                            {hub.location}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedHub && (
          <Button
            onClick={handleLink}
            disabled={linkToHubMutation.isPending}
            className="w-full"
          >
            {linkToHubMutation.isPending ? "Vinculando..." : "Vincular al hub"}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Asigna el usuario a un hub local para organización regional.
      </p>
    </div>
  );
}
