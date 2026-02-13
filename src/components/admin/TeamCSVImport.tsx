import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Users, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import {
  validateMemberForTeam,
  createValidationCache,
  prefetchUserData,
  prefetchTeamData,
} from "@/lib/team-member-validation";

interface TeamCSVImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface CSVTeamRow {
  "Team ID": string;
  "Name": string;
  "Division": string;
  "Student emails": string;
  "Mentor emails": string;
  "City"?: string;
  "State"?: string;
  [key: string]: string | undefined;
}

interface ParsedTeam {
  tg_team_id: string;
  name: string;
  category: "beginner" | "junior" | "senior" | null;
  studentEmails: string[];
  mentorEmails: string[];
  existsInDb: boolean;
  studentsFound: number;
  mentorsFound: number;
}

interface ImportResult {
  teamsCreated: number;
  teamsUpdated: number;
  membersLinked: number;
  authorizedStudentsUpdated: number;
  errors: string[];
  skipped: string[];
}

type ImportStep = "upload" | "preview" | "processing" | "results";

const divisionToCategory = (division: string): "beginner" | "junior" | "senior" | null => {
  const normalized = division?.toLowerCase().trim();
  if (normalized === "beginner") return "beginner";
  if (normalized === "junior") return "junior";
  if (normalized === "senior") return "senior";
  return null;
};

const parseEmails = (emailString: string): string[] => {
  if (!emailString) return [];
  return emailString
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
};

export function TeamCSVImport({ open, onOpenChange, onImportComplete }: TeamCSVImportProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedTeams, setParsedTeams] = useState<ParsedTeam[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState("");

  const resetState = useCallback(() => {
    setStep("upload");
    setParsedTeams([]);
    setProgress(0);
    setResult(null);
    setIsProcessing(false);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleFileSelect = useCallback(async (file: File) => {
    // Level 1: File validation
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo no puede superar los 5MB");
      return;
    }

    setFileName(file.name);
    
    Papa.parse<CSVTeamRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        
        // Level 2: Structure validation
        if (rows.length === 0) {
          toast.error("El archivo CSV está vacío");
          return;
        }

        // Check row limit
        if (rows.length > 1000) {
          toast.error(`El archivo tiene ${rows.length.toLocaleString()} equipos. El máximo permitido es 1,000.`);
          return;
        }

        // Verify required columns
        const requiredColumns = ["Team ID", "Name", "Division"];
        const headers = Object.keys(rows[0]);
        const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          toast.error(`Columnas faltantes: ${missingColumns.join(", ")}`);
          return;
        }

        // Validate Team ID format
        const invalidTeamIds = rows.filter(r => 
          !r["Team ID"] || !/^[A-Za-z0-9_-]+$/.test(r["Team ID"])
        );
        if (invalidTeamIds.length > 0) {
          toast.error(
            `${invalidTeamIds.length} fila(s) tienen Team ID inválido o vacío. ` +
            `El Team ID debe contener solo letras, números, guiones o guiones bajos.`
          );
          return;
        }

        // Check for duplicate Team IDs in CSV
        const teamIds = rows.map((r) => r["Team ID"]).filter(Boolean);
        const duplicateIds = teamIds.filter((id, idx) => teamIds.indexOf(id) !== idx);
        if (duplicateIds.length > 0) {
          toast.warning(
            `Se encontraron ${duplicateIds.length} Team ID duplicados en el archivo. ` +
            `Solo se procesará la primera aparición de cada uno.`
          );
        }
        
        // Check which teams already exist
        const { data: existingTeams } = await supabase
          .from("teams")
          .select("tg_team_id")
          .in("tg_team_id", teamIds);
        
        const existingTeamIds = new Set(existingTeams?.map((t) => t.tg_team_id) || []);

        // Collect all emails to check profiles
        const allStudentEmails: string[] = [];
        const allMentorEmails: string[] = [];
        
        rows.forEach((row) => {
          allStudentEmails.push(...parseEmails(row["Student emails"] || ""));
          allMentorEmails.push(...parseEmails(row["Mentor emails"] || ""));
        });

        const uniqueEmails = [...new Set([...allStudentEmails, ...allMentorEmails])];
        
        // Fetch profiles for all emails
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, tg_email")
          .or(
            uniqueEmails.map((e) => `email.ilike.${e}`).join(",") +
            "," +
            uniqueEmails.map((e) => `tg_email.ilike.${e}`).join(",")
          );

        const profileEmailMap = new Map<string, string>();
        profiles?.forEach((p) => {
          if (p.email) profileEmailMap.set(p.email.toLowerCase(), p.id);
          if (p.tg_email) profileEmailMap.set(p.tg_email.toLowerCase(), p.id);
        });

        // Parse each team
        const parsed: ParsedTeam[] = rows.map((row) => {
          const studentEmails = parseEmails(row["Student emails"] || "");
          const mentorEmails = parseEmails(row["Mentor emails"] || "");
          
          const studentsFound = studentEmails.filter((e) => profileEmailMap.has(e)).length;
          const mentorsFound = mentorEmails.filter((e) => profileEmailMap.has(e)).length;

          return {
            tg_team_id: row["Team ID"],
            name: row["Name"],
            category: divisionToCategory(row["Division"]),
            studentEmails,
            mentorEmails,
            existsInDb: existingTeamIds.has(row["Team ID"]),
            studentsFound,
            mentorsFound,
          };
        });

        setParsedTeams(parsed);
        setStep("preview");
      },
      error: (error) => {
        toast.error(`Error al procesar CSV: ${error.message}`);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        handleFileSelect(file);
      } else {
        toast.error("Por favor, sube un archivo CSV válido");
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const processImport = useCallback(async () => {
    setStep("processing");
    setIsProcessing(true);
    setProgress(0);

    const importResult: ImportResult = {
      teamsCreated: 0,
      teamsUpdated: 0,
      membersLinked: 0,
      authorizedStudentsUpdated: 0,
      errors: [],
      skipped: [],
    };

    const totalSteps = parsedTeams.length;
    let completedSteps = 0;

    // Collect all emails for profile lookup
    const allEmails: string[] = [];
    parsedTeams.forEach((team) => {
      allEmails.push(...team.studentEmails, ...team.mentorEmails);
    });
    const uniqueEmails = [...new Set(allEmails)];

    // Fetch profiles matching the emails in the CSV (in batches to avoid row limits)
    const profileEmailMap = new Map<string, string>();
    const PROFILE_BATCH_SIZE = 500;

    for (let i = 0; i < uniqueEmails.length; i += PROFILE_BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + PROFILE_BATCH_SIZE);

      const [{ data: byEmail }, { data: byTgEmail }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, tg_email")
          .in("email", batch),
        supabase
          .from("profiles")
          .select("id, email, tg_email")
          .in("tg_email", batch),
      ]);

      [...(byEmail || []), ...(byTgEmail || [])].forEach((p) => {
        if (p.email) profileEmailMap.set(p.email.toLowerCase(), p.id);
        if (p.tg_email) profileEmailMap.set(p.tg_email.toLowerCase(), p.id);
      });
    }

    // Process each team
    for (const team of parsedTeams) {
      try {
        let teamId: string;

        // Check if team exists
        const { data: existingTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("tg_team_id", team.tg_team_id)
          .maybeSingle();

        if (existingTeam) {
          // Update existing team
          await supabase
            .from("teams")
            .update({
              name: team.name,
              category: team.category,
            })
            .eq("id", existingTeam.id);
          
          teamId = existingTeam.id;
          importResult.teamsUpdated++;
        } else {
          // Create new team
          const { data: newTeam, error: createError } = await supabase
            .from("teams")
            .insert({
              name: team.name,
              tg_team_id: team.tg_team_id,
              category: team.category,
            })
            .select("id")
            .single();

          if (createError) throw createError;
          teamId = newTeam.id;
          importResult.teamsCreated++;
        }

        // Create validation cache for this team
        const validationCache = createValidationCache();
        await prefetchTeamData(teamId, validationCache);

        // Collect all user IDs for this team
        const userIdsToValidate: string[] = [];
        for (const email of [...team.studentEmails, ...team.mentorEmails]) {
          const userId = profileEmailMap.get(email);
          if (userId) userIdsToValidate.push(userId);
        }
        
        // Prefetch user data for batch validation
        if (userIdsToValidate.length > 0) {
          await prefetchUserData(userIdsToValidate, validationCache);
        }

        // Process student emails with validation
        for (const email of team.studentEmails) {
          const userId = profileEmailMap.get(email);
          
          if (userId) {
            // Validate before adding
            const validation = await validateMemberForTeam(userId, teamId, validationCache);
            
            if (!validation.valid) {
              if (validation.skipped) {
                importResult.skipped.push(`${email}: ${validation.reason}`);
              } else {
                importResult.errors.push(`${email}: ${validation.reason}`);
              }
              continue;
            }

            // Check if already a member
            const { data: existingMember } = await supabase
              .from("team_members")
              .select("id")
              .eq("team_id", teamId)
              .eq("user_id", userId)
              .maybeSingle();

            if (!existingMember) {
              const { error: insertError } = await supabase
                .from("team_members")
                .insert({
                  team_id: teamId,
                  user_id: userId,
                  member_type: validation.memberType, // Use validated member type
                });
              
              if (insertError) {
                console.error("Error inserting team member:", insertError);
                importResult.errors.push(`Error vinculando estudiante ${email}: ${insertError.message}`);
              } else {
                importResult.membersLinked++;
              }
            }
          } else {
            // Update authorized_students if exists
            const { data: authorizedStudent } = await supabase
              .from("authorized_students")
              .select("id")
              .ilike("email", email)
              .maybeSingle();

            if (authorizedStudent) {
              await supabase
                .from("authorized_students")
                .update({
                  team_name: team.name,
                  team_division: team.category,
                })
                .eq("id", authorizedStudent.id);
              importResult.authorizedStudentsUpdated++;
            }
          }
        }

        // Process mentor emails with validation
        for (const email of team.mentorEmails) {
          const userId = profileEmailMap.get(email);
          
          if (userId) {
            // Validate before adding
            const validation = await validateMemberForTeam(userId, teamId, validationCache);
            
            if (!validation.valid) {
              if (validation.skipped) {
                importResult.skipped.push(`${email}: ${validation.reason}`);
              } else {
                importResult.errors.push(`${email}: ${validation.reason}`);
              }
              continue;
            }

            // Check if already a member
            const { data: existingMember } = await supabase
              .from("team_members")
              .select("id")
              .eq("team_id", teamId)
              .eq("user_id", userId)
              .maybeSingle();

            if (!existingMember) {
              const { error: insertError } = await supabase
                .from("team_members")
                .insert({
                  team_id: teamId,
                  user_id: userId,
                  member_type: validation.memberType, // Use validated member type
                });

              if (insertError) {
                console.error("Error inserting team member:", insertError);
                importResult.errors.push(`Error vinculando mentor ${email}: ${insertError.message}`);
              } else {
                importResult.membersLinked++;
              }
            }
          } else {
            // Mentor not registered yet - update authorized_users team_name
            // so the auto-verify trigger links them when they register
            const { data: authorizedUser } = await supabase
              .from("authorized_users")
              .select("id, team_name")
              .ilike("email", email)
              .maybeSingle();

            if (authorizedUser) {
              const existingNames = (authorizedUser.team_name || "")
                .replace(/\s+and\s+/gi, ",")
                .split(",")
                .map((s: string) => s.trim().toLowerCase())
                .filter((s: string) => s.length > 0);

              if (!existingNames.includes(team.name.toLowerCase())) {
                const updatedTeamName = authorizedUser.team_name
                  ? `${authorizedUser.team_name}, ${team.name}`
                  : team.name;

                await supabase
                  .from("authorized_users")
                  .update({ team_name: updatedTeamName })
                  .eq("id", authorizedUser.id);
              }
            }
          }
        }
      } catch (error: any) {
        importResult.errors.push(`Error en equipo "${team.name}": ${error.message}`);
      }

      completedSteps++;
      setProgress(Math.round((completedSteps / totalSteps) * 100));
    }

    // Log the import
    try {
      await supabase.from("csv_imports").insert({
        file_name: fileName,
        uploaded_by: user?.id,
        records_processed: parsedTeams.length,
        records_new: importResult.teamsCreated,
        records_updated: importResult.teamsUpdated,
        status: importResult.errors.length > 0 ? "completed_with_errors" : "completed",
        errors: importResult.errors.length > 0 ? importResult.errors : null,
      });
    } catch (e) {
      console.error("Error logging import:", e);
    }

    setResult(importResult);
    setIsProcessing(false);
    setStep("results");
  }, [parsedTeams, fileName, user?.id]);

  const handleConfirmResults = useCallback(() => {
    onImportComplete();
    handleClose();
  }, [onImportComplete, handleClose]);

  const teamsToCreate = parsedTeams.filter((t) => !t.existsInDb).length;
  const teamsToUpdate = parsedTeams.filter((t) => t.existsInDb).length;
  const totalStudents = parsedTeams.reduce((sum, t) => sum + t.studentEmails.length, 0);
  const totalMentors = parsedTeams.reduce((sum, t) => sum + t.mentorEmails.length, 0);
  const studentsFound = parsedTeams.reduce((sum, t) => sum + t.studentsFound, 0);
  const mentorsFound = parsedTeams.reduce((sum, t) => sum + t.mentorsFound, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Equipos desde CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Sube un archivo CSV exportado desde Technovation Global"}
            {step === "preview" && "Revisa los equipos que se importarán"}
            {step === "processing" && "Procesando importación..."}
            {step === "results" && "Importación completada"}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleInputChange}
            />
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">
              Arrastra un archivo CSV aquí
            </p>
            <p className="text-sm text-muted-foreground">
              o haz clic para seleccionarlo
            </p>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">{teamsToCreate}</p>
                <p className="text-xs text-muted-foreground">Equipos nuevos</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-warning">{teamsToUpdate}</p>
                <p className="text-xs text-muted-foreground">A actualizar</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{studentsFound}/{totalStudents}</p>
                <p className="text-xs text-muted-foreground">Estudiantes</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{mentorsFound}/{totalMentors}</p>
                <p className="text-xs text-muted-foreground">Mentores</p>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-center">Estudiantes</TableHead>
                    <TableHead className="text-center">Mentores</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTeams.map((team, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{team.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {team.tg_team_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {team.category ? (
                          <Badge variant="outline" className="capitalize">
                            {team.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={team.studentsFound > 0 ? "text-success" : ""}>
                          {team.studentsFound}
                        </span>
                        <span className="text-muted-foreground">/{team.studentEmails.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={team.mentorsFound > 0 ? "text-success" : ""}>
                          {team.mentorsFound}
                        </span>
                        <span className="text-muted-foreground">/{team.mentorEmails.length}</span>
                      </TableCell>
                      <TableCell>
                        {team.existsInDb ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning">
                            Actualizar
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-success/10 text-success">
                            Nuevo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Volver
              </Button>
              <Button onClick={processImport}>
                <Users className="mr-2 h-4 w-4" />
                Importar {parsedTeams.length} equipos
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="py-12 space-y-6">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Procesando equipos...</p>
              <p className="text-sm text-muted-foreground">
                Por favor, no cierres esta ventana
              </p>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {progress}% completado
            </p>
          </div>
        )}

        {/* Results Step */}
        {step === "results" && result && (
          <>
            <div className="py-6 space-y-6">
              <div className="flex items-center justify-center gap-3">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="h-12 w-12 text-success" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-warning" />
                )}
                <div>
                  <p className="text-lg font-medium">
                    {result.errors.length === 0
                      ? "¡Importación completada!"
                      : "Importación completada con errores"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-success">{result.teamsCreated}</p>
                  <p className="text-xs text-muted-foreground">Equipos creados</p>
                </div>
                <div className="bg-warning/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-warning">{result.teamsUpdated}</p>
                  <p className="text-xs text-muted-foreground">Equipos actualizados</p>
                </div>
                <div className="bg-info/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-info">{result.membersLinked}</p>
                  <p className="text-xs text-muted-foreground">Miembros vinculados</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-secondary-foreground">{result.authorizedStudentsUpdated}</p>
                  <p className="text-xs text-muted-foreground">Estudiantes pendientes</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="font-medium text-destructive flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4" />
                    {result.errors.length} errores
                  </p>
                  <ScrollArea className="max-h-32">
                    <ul className="text-sm space-y-1">
                      {result.errors.map((error, idx) => (
                        <li key={idx} className="text-destructive/80">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleConfirmResults}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
