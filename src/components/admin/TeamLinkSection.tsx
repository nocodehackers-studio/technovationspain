import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Users, ChevronDown, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Team } from "@/types/database";

interface TeamLinkSectionProps {
  userId: string;
  currentTeamId?: string | null;
  currentTeamName?: string | null;
  currentMemberType?: "participant" | "mentor" | null;
}

export function TeamLinkSection({
  userId,
  currentTeamId,
  currentTeamName,
  currentMemberType,
}: TeamLinkSectionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [memberType, setMemberType] = useState<"participant" | "mentor">(
    currentMemberType || "participant"
  );

  // Fetch all teams for selection
  const { data: teams } = useQuery({
    queryKey: ["admin-teams-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, category")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Reset selected team when user changes
  useEffect(() => {
    setSelectedTeam(null);
    setMemberType(currentMemberType || "participant");
  }, [userId, currentMemberType]);

  // Link user to team mutation
  const linkToTeamMutation = useMutation({
    mutationFn: async ({
      teamId,
      type,
    }: {
      teamId: string;
      type: "participant" | "mentor";
    }) => {
      // First remove any existing team membership
      await supabase.from("team_members").delete().eq("user_id", userId);

      // Insert new team membership
      const { error } = await supabase.from("team_members").insert({
        user_id: userId,
        team_id: teamId,
        member_type: type,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      toast.success("Usuario vinculado al equipo");
      setSelectedTeam(null);
    },
    onError: (error) => {
      toast.error(`Error al vincular: ${error.message}`);
    },
  });

  // Unlink from team mutation
  const unlinkFromTeamMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      toast.success("Usuario desvinculado del equipo");
    },
    onError: (error) => {
      toast.error(`Error al desvincular: ${error.message}`);
    },
  });

  const handleLink = () => {
    if (!selectedTeam) return;
    linkToTeamMutation.mutate({
      teamId: selectedTeam.id,
      type: memberType,
    });
  };

  const handleUnlink = () => {
    unlinkFromTeamMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Users className="h-4 w-4" />
        Equipo
      </h3>

      {/* Current team info */}
      {currentTeamName && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{currentTeamName}</span>
            {currentMemberType && (
              <Badge
                variant="outline"
                className={
                  currentMemberType === "mentor"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-secondary/50 text-secondary-foreground"
                }
              >
                {currentMemberType === "mentor" ? "Mentor" : "Estudiante"}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleUnlink}
            disabled={unlinkFromTeamMutation.isPending}
          >
            <X className="h-4 w-4 mr-1" />
            Desvincular
          </Button>
        </div>
      )}

      {/* Team selector */}
      <div className="space-y-3">
        <Label>{currentTeamName ? "Cambiar a otro equipo" : "Vincular a equipo"}</Label>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedTeam ? selectedTeam.name : "Buscar equipo..."}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar equipo..." />
              <CommandList>
                <CommandEmpty>No se encontraron equipos</CommandEmpty>
                <CommandGroup>
                  {teams?.map((team) => (
                    <CommandItem
                      key={team.id}
                      value={team.name}
                      onSelect={() => {
                        setSelectedTeam(team);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedTeam?.id === team.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{team.name}</span>
                        {team.category && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {team.category}
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

        {selectedTeam && (
          <>
            {/* Member type selector */}
            <div className="space-y-2">
              <Label>Tipo de miembro</Label>
              <RadioGroup
                value={memberType}
                onValueChange={(value) => setMemberType(value as "participant" | "mentor")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="participant" id="participant" />
                  <Label htmlFor="participant" className="font-normal cursor-pointer">
                    Estudiante
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mentor" id="mentor" />
                  <Label htmlFor="mentor" className="font-normal cursor-pointer">
                    Mentor
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={handleLink}
              disabled={linkToTeamMutation.isPending}
              className="w-full"
            >
              {linkToTeamMutation.isPending ? "Vinculando..." : "Vincular al equipo"}
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Vincula al usuario a un equipo como estudiante o mentor.
        {currentTeamName && " Si cambias de equipo, se desvinculará del anterior automáticamente."}
      </p>
    </div>
  );
}
