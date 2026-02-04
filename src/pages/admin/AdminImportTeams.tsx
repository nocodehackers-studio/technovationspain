import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Users, UserCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  validateMemberForTeam,
  createValidationCache,
  prefetchUserData,
  prefetchTeamData,
} from "@/lib/team-member-validation";

// Types
interface TeamCSVRow {
  "Team ID": string;
  "Name": string;
  "Division": string;
  "Student emails": string;
  "Mentor emails": string;
  "City"?: string;
  "State"?: string;
  "Has mentor?"?: string;
  "Has students?"?: string;
  "Number of students"?: string;
  "Number of mentors"?: string;
  "Qualified"?: string;
}

interface ParsedTeam {
  tgTeamId: string;
  name: string;
  division: string;
  studentEmails: string[];
  mentorEmails: string[];
  city?: string;
  state?: string;
}

interface PreviewStats {
  totalTeams: number;
  newTeams: number;
  existingTeams: number;
  byDivision: { beginner: number; junior: number; senior: number };
  totalStudentEmails: number;
  studentsFound: number;
  totalMentorEmails: number;
  mentorsFound: number;
}

interface ImportResults {
  teamsCreated: number;
  teamsUpdated: number;
  membersLinked: number;
  whitelistUpdated: number;
  errors: string[];
  skipped: string[];
}

type ImportStep = "upload" | "preview" | "processing" | "results";

const REQUIRED_HEADERS = ["Team ID", "Name", "Division"];
const MAX_TEAMS = 1000;
const BATCH_SIZE = 50;

export default function AdminImportTeams() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [parsedTeams, setParsedTeams] = useState<ParsedTeam[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [results, setResults] = useState<ImportResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Parse emails from comma-separated string
  const parseEmails = (emailString: string): string[] => {
    if (!emailString) return [];
    return emailString
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));
  };

  // Map division string to category
  const mapDivision = (division: string): string => {
    const d = division?.toLowerCase().trim();
    if (d === "beginner") return "beginner";
    if (d === "junior") return "junior";
    if (d === "senior") return "senior";
    return "junior"; // Default
  };

  // Validate CSV structure
  const validateCSV = (headers: string[]): { valid: boolean; missing: string[] } => {
    const missing = REQUIRED_HEADERS.filter(
      (h) => !headers.some((header) => header.toLowerCase() === h.toLowerCase())
    );
    return { valid: missing.length === 0, missing };
  };

  // Parse CSV file
  const parseCSVFile = (file: File): Promise<ParsedTeam[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<TeamCSVRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const validation = validateCSV(headers);

          if (!validation.valid) {
            reject(new Error(`Columnas requeridas no encontradas: ${validation.missing.join(", ")}`));
            return;
          }

          if (results.data.length > MAX_TEAMS) {
            reject(new Error(`El archivo tiene ${results.data.length} equipos, máximo permitido: ${MAX_TEAMS}`));
            return;
          }

          const teams: ParsedTeam[] = results.data
            .filter((row) => row["Team ID"]?.trim())
            .map((row) => ({
              tgTeamId: row["Team ID"].trim(),
              name: row["Name"]?.trim() || "",
              division: mapDivision(row["Division"]),
              studentEmails: parseEmails(row["Student emails"]),
              mentorEmails: parseEmails(row["Mentor emails"]),
              city: row["City"]?.trim(),
              state: row["State"]?.trim(),
            }));

          resolve(teams);
        },
        error: (error) => {
          reject(new Error(`Error al procesar el archivo: ${error.message}`));
        },
      });
    });
  };

  // Analyze teams and generate preview stats
  const analyzeTeams = async (teams: ParsedTeam[]): Promise<PreviewStats> => {
    // Get existing teams by tg_team_id
    const tgTeamIds = teams.map((t) => t.tgTeamId);
    const { data: existingTeams } = await supabase
      .from("teams")
      .select("tg_team_id")
      .in("tg_team_id", tgTeamIds);

    const existingSet = new Set(existingTeams?.map((t) => t.tg_team_id) || []);

    // Collect all unique emails
    const allStudentEmails = [...new Set(teams.flatMap((t) => t.studentEmails))];
    const allMentorEmails = [...new Set(teams.flatMap((t) => t.mentorEmails))];
    const allEmails = [...new Set([...allStudentEmails, ...allMentorEmails])];

    // Check how many exist in profiles
    let studentsFound = 0;
    let mentorsFound = 0;

    if (allEmails.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, tg_email")
        .or(`email.in.(${allEmails.join(",")}),tg_email.in.(${allEmails.join(",")})`);

      const profileEmails = new Set<string>();
      profiles?.forEach((p) => {
        if (p.email) profileEmails.add(p.email.toLowerCase());
        if (p.tg_email) profileEmails.add(p.tg_email.toLowerCase());
      });

      studentsFound = allStudentEmails.filter((e) => profileEmails.has(e)).length;
      mentorsFound = allMentorEmails.filter((e) => profileEmails.has(e)).length;
    }

    // Count by division
    const byDivision = { beginner: 0, junior: 0, senior: 0 };
    teams.forEach((t) => {
      if (t.division === "beginner") byDivision.beginner++;
      else if (t.division === "junior") byDivision.junior++;
      else if (t.division === "senior") byDivision.senior++;
    });

    return {
      totalTeams: teams.length,
      newTeams: teams.filter((t) => !existingSet.has(t.tgTeamId)).length,
      existingTeams: teams.filter((t) => existingSet.has(t.tgTeamId)).length,
      byDivision,
      totalStudentEmails: allStudentEmails.length,
      studentsFound,
      totalMentorEmails: allMentorEmails.length,
      mentorsFound,
    };
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Formato inválido",
        description: "Por favor selecciona un archivo CSV.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      const teams = await parseCSVFile(file);
      setParsedTeams(teams);

      const stats = await analyzeTeams(teams);
      setPreviewStats(stats);

      setStep("preview");
      toast({
        title: "Archivo procesado",
        description: `${teams.length} equipos encontrados.`,
      });
    } catch (error) {
      toast({
        title: "Error al procesar",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Process import
  const processImport = async () => {
    if (!user?.id) return;

    setStep("processing");
    setProgress(0);
    setProgressMessage("Iniciando importación...");

    const results: ImportResults = {
      teamsCreated: 0,
      teamsUpdated: 0,
      membersLinked: 0,
      whitelistUpdated: 0,
      errors: [],
      skipped: [],
    };

    try {
      // Create import log
      const { data: importLog } = await supabase
        .from("csv_imports")
        .insert({
          file_name: fileName,
          uploaded_by: user.id,
          status: "processing",
          records_processed: 0,
        })
        .select()
        .single();

      const totalBatches = Math.ceil(parsedTeams.length / BATCH_SIZE);

      for (let i = 0; i < parsedTeams.length; i += BATCH_SIZE) {
        const batch = parsedTeams.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        setProgressMessage(`Procesando lote ${batchNumber}/${totalBatches}...`);
        setProgress(Math.round((i / parsedTeams.length) * 100));

        for (const team of batch) {
          try {
            // Check if team exists by tg_team_id first
            let existingTeam: { id: string } | null = null;
            
            const { data: teamByTgId } = await supabase
              .from("teams")
              .select("id")
              .eq("tg_team_id", team.tgTeamId)
              .maybeSingle();

            if (teamByTgId) {
              existingTeam = teamByTgId;
            } else {
              // If not found by tg_team_id, search by exact name (case-insensitive)
              // This handles teams created during participant import
              const { data: teamByName } = await supabase
                .from("teams")
                .select("id")
                .ilike("name", team.name)
                .maybeSingle();
              
              existingTeam = teamByName;
            }

            let teamId: string;

            if (existingTeam) {
              // Update existing team (add tg_team_id if it didn't have one)
              const { error: updateError } = await supabase
                .from("teams")
                .update({
                  name: team.name,
                  category: team.division,
                  tg_team_id: team.tgTeamId, // Always update tg_team_id
                })
                .eq("id", existingTeam.id);

              if (updateError) throw updateError;
              teamId = existingTeam.id;
              results.teamsUpdated++;
            } else {
              // Create new team
              const { data: newTeam, error: insertError } = await supabase
                .from("teams")
                .insert({
                  tg_team_id: team.tgTeamId,
                  name: team.name,
                  category: team.division,
                })
                .select()
                .single();

              if (insertError) throw insertError;
              teamId = newTeam.id;
              results.teamsCreated++;
            }

            // Create validation cache for this team
            const validationCache = createValidationCache();
            await prefetchTeamData(teamId, validationCache);

            // Collect all emails for profile lookup
            const allEmailsForTeam = [...team.studentEmails, ...team.mentorEmails];
            
            // Get profile IDs for validation prefetch
            const profileIdsToValidate: string[] = [];
            for (const email of allEmailsForTeam) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .or(`email.ilike.${email},tg_email.ilike.${email}`)
                .maybeSingle();
              if (profile) profileIdsToValidate.push(profile.id);
            }
            
            if (profileIdsToValidate.length > 0) {
              await prefetchUserData(profileIdsToValidate, validationCache);
            }

            // Link students with validation
            for (const email of team.studentEmails) {
              const linked = await linkUserToTeamWithValidation(
                teamId,
                email,
                team.name,
                team.division,
                validationCache
              );
              if (linked.memberLinked) results.membersLinked++;
              if (linked.whitelistUpdated) results.whitelistUpdated++;
              if (linked.error) results.errors.push(`${email}: ${linked.error}`);
              if (linked.skipped) results.skipped.push(`${email}: ${linked.skipReason}`);
            }

            // Link mentors with validation
            for (const email of team.mentorEmails) {
              const linked = await linkUserToTeamWithValidation(
                teamId,
                email,
                team.name,
                team.division,
                validationCache
              );
              if (linked.memberLinked) results.membersLinked++;
              if (linked.whitelistUpdated) results.whitelistUpdated++;
              if (linked.error) results.errors.push(`${email}: ${linked.error}`);
              if (linked.skipped) results.skipped.push(`${email}: ${linked.skipReason}`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Error desconocido";
            results.errors.push(`Equipo ${team.name}: ${message}`);
          }
        }
      }

      // Update import log
      if (importLog) {
        await supabase
          .from("csv_imports")
          .update({
            status: "completed",
            records_processed: parsedTeams.length,
            records_new: results.teamsCreated,
            records_updated: results.teamsUpdated,
            errors: results.errors.length > 0 ? { list: results.errors.slice(0, 100) } : null,
          })
          .eq("id", importLog.id);
      }

      setProgress(100);
      setProgressMessage("¡Importación completada!");
      setResults(results);
      setStep("results");
    } catch (error) {
      toast({
        title: "Error en la importación",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
      setStep("preview");
    }
  };

  // Link user to team with validation or update whitelist
  const linkUserToTeamWithValidation = async (
    teamId: string,
    email: string,
    teamName: string,
    teamDivision: string,
    validationCache: ReturnType<typeof createValidationCache>
  ): Promise<{
    memberLinked: boolean;
    whitelistUpdated: boolean;
    error?: string;
    skipped?: boolean;
    skipReason?: string;
  }> => {
    try {
      // Search in profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`email.ilike.${email},tg_email.ilike.${email}`)
        .maybeSingle();

      if (profile) {
        // Validate before adding
        const validation = await validateMemberForTeam(profile.id, teamId, validationCache);
        
        if (!validation.valid) {
          return {
            memberLinked: false,
            whitelistUpdated: false,
            skipped: validation.skipped,
            skipReason: validation.reason,
            error: validation.skipped ? undefined : validation.reason,
          };
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from("team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("user_id", profile.id)
          .maybeSingle();

        if (!existingMember) {
          // Add as team member with validated member_type
          const { error } = await supabase.from("team_members").insert({
            team_id: teamId,
            user_id: profile.id,
            member_type: validation.memberType,
          });

          if (error) return { memberLinked: false, whitelistUpdated: false, error: error.message };
          return { memberLinked: true, whitelistUpdated: false };
        }

        return { memberLinked: false, whitelistUpdated: false }; // Already a member
      }

      // Not in profiles, check authorized_users
      const { data: authorizedUser } = await supabase
        .from("authorized_users")
        .select("id, matched_profile_id")
        .ilike("email", email)
        .maybeSingle();

      if (authorizedUser && !authorizedUser.matched_profile_id) {
        // Update whitelist with team info
        const { error } = await supabase
          .from("authorized_users")
          .update({
            team_name: teamName,
            team_division: teamDivision,
          })
          .eq("id", authorizedUser.id);

        if (error) return { memberLinked: false, whitelistUpdated: false, error: error.message };
        return { memberLinked: false, whitelistUpdated: true };
      }

      return { memberLinked: false, whitelistUpdated: false };
    } catch (error) {
      return {
        memberLinked: false,
        whitelistUpdated: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  };

  // Keep old function for compatibility but mark as unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const linkUserToTeam = async (
    teamId: string,
    email: string,
    memberType: "participant" | "mentor",
    teamName: string,
    teamDivision: string
  ): Promise<{ memberLinked: boolean; whitelistUpdated: boolean; error?: string }> => {
    try {
      // Search in profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`email.ilike.${email},tg_email.ilike.${email}`)
        .maybeSingle();

      if (profile) {
        // Check if already a member
        const { data: existingMember } = await supabase
          .from("team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("user_id", profile.id)
          .maybeSingle();

        if (!existingMember) {
          // Add as team member
          const { error } = await supabase.from("team_members").insert({
            team_id: teamId,
            user_id: profile.id,
            member_type: memberType,
          });

          if (error) return { memberLinked: false, whitelistUpdated: false, error: error.message };
          return { memberLinked: true, whitelistUpdated: false };
        }

        return { memberLinked: false, whitelistUpdated: false }; // Already a member
      }

      // Not in profiles, check authorized_users
      const { data: authorizedUser } = await supabase
        .from("authorized_users")
        .select("id, matched_profile_id")
        .ilike("email", email)
        .maybeSingle();

      if (authorizedUser && !authorizedUser.matched_profile_id) {
        // Update whitelist with team info
        const { error } = await supabase
          .from("authorized_users")
          .update({
            team_name: teamName,
            team_division: teamDivision,
          })
          .eq("id", authorizedUser.id);

        if (error) return { memberLinked: false, whitelistUpdated: false, error: error.message };
        return { memberLinked: false, whitelistUpdated: true };
      }

      return { memberLinked: false, whitelistUpdated: false };
    } catch (error) {
      return {
        memberLinked: false,
        whitelistUpdated: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setParsedTeams([]);
    setPreviewStats(null);
    setProgress(0);
    setProgressMessage("");
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get division badge variant
  const getDivisionVariant = (division: string): "green" | "blue" | "purple" => {
    switch (division) {
      case "beginner":
        return "green";
      case "junior":
        return "blue";
      case "senior":
        return "purple";
      default:
        return "blue";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar Equipos</h1>
          <p className="text-muted-foreground">
            Importa equipos desde el CSV de Technovation Global y vincula automáticamente a los usuarios.
          </p>
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Subir archivo CSV de equipos
              </CardTitle>
              <CardDescription>
                Arrastra el archivo CSV o haz clic para seleccionarlo. El archivo debe contener las columnas: Team ID, Name, Division.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  {isLoading ? "Procesando..." : "Arrastra tu archivo CSV aquí"}
                </p>
                <p className="text-sm text-muted-foreground">
                  o haz clic para seleccionar un archivo
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Preview */}
        {step === "preview" && previewStats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Equipos</CardDescription>
                  <CardTitle className="text-2xl">{previewStats.totalTeams}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 text-sm">
                    <span className="text-success">+{previewStats.newTeams} nuevos</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-accent-foreground">{previewStats.existingTeams} existentes</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Por División</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="green">{previewStats.byDivision.beginner} Beginner</Badge>
                  <Badge variant="blue">{previewStats.byDivision.junior} Junior</Badge>
                  <Badge variant="purple">{previewStats.byDivision.senior} Senior</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Estudiantes</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {previewStats.totalStudentEmails}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <span className="text-success">{previewStats.studentsFound} con perfil</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">
                      {previewStats.totalStudentEmails - previewStats.studentsFound} pendientes
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Mentores</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    {previewStats.totalMentorEmails}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <span className="text-success">{previewStats.mentorsFound} con perfil</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">
                      {previewStats.totalMentorEmails - previewStats.mentorsFound} pendientes
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview Table */}
            <Card>
              <CardHeader>
                <CardTitle>Vista previa de equipos</CardTitle>
                <CardDescription>Mostrando los primeros 20 equipos del archivo</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team ID</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>División</TableHead>
                        <TableHead>Estudiantes</TableHead>
                        <TableHead>Mentores</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTeams.slice(0, 20).map((team, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{team.tgTeamId}</TableCell>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>
                            <Badge variant={getDivisionVariant(team.division)}>
                              {team.division.charAt(0).toUpperCase() + team.division.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{team.studentEmails.length}</TableCell>
                          <TableCell>{team.mentorEmails.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={handleReset}>
                Cancelar
              </Button>
              <Button onClick={processImport} disabled={isLoading}>
                Importar {previewStats.totalTeams} equipos
              </Button>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Procesando importación
              </CardTitle>
              <CardDescription>{progressMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-3" />
              <p className="text-center text-muted-foreground">{progress}% completado</p>
            </CardContent>
          </Card>
        )}

        {/* Step: Results */}
        {step === "results" && results && (
          <div className="space-y-6">
            <Alert className={results.errors.length > 0 ? "border-warning" : "border-success"}>
              {results.errors.length > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertTitle>
                {results.errors.length > 0 ? "Importación completada con advertencias" : "Importación exitosa"}
              </AlertTitle>
              <AlertDescription>
                Se han procesado {parsedTeams.length} equipos del archivo.
              </AlertDescription>
            </Alert>

            {/* Results Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Equipos creados</CardDescription>
                  <CardTitle className="text-2xl text-success">{results.teamsCreated}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Equipos actualizados</CardDescription>
                  <CardTitle className="text-2xl text-primary">{results.teamsUpdated}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Miembros vinculados</CardDescription>
                  <CardTitle className="text-2xl text-accent-foreground">{results.membersLinked}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Whitelist actualizada</CardDescription>
                  <CardTitle className="text-2xl text-warning">{results.whitelistUpdated}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Errors */}
            {results.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    Errores ({results.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <ul className="space-y-1 text-sm">
                      {results.errors.map((error, index) => (
                        <li key={index} className="text-destructive">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleReset}>Importar otro archivo</Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
