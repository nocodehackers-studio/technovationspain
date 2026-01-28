import { useState, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, 
  ArrowLeft, ArrowRight, Users, UserPlus, RefreshCw, AlertTriangle,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { ImportSummaryCard } from "@/components/admin/import/ImportSummaryCard";
import { ConflictResolver } from "@/components/admin/import/ConflictResolver";
import { ConflictRecord, ConflictType } from "@/components/admin/import/ConflictTable";
import { ProfileType, ProfileTypeBadge } from "@/components/admin/import/ProfileTypeBadge";

type ImportStep = "upload" | "validation-error" | "preview" | "conflicts" | "processing" | "results";

interface CSVRow {
  [key: string]: string;
}

interface ParsedRecord {
  _csvRowIndex: number;
  email?: string;
  tg_id?: string;
  profile_type?: ProfileType;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company_name?: string;
  school_name?: string;
  team_name?: string;
  team_division?: string;
  parent_name?: string;
  parent_email?: string;
  city?: string;
  state?: string;
  age?: number;
  parental_consent?: string;
  media_consent?: string;
  signed_up_at?: string;
  [key: string]: any;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data: CSVRow }[];
}

// Mapping from CSV headers to DB fields
const CSV_FIELD_MAPPINGS: Record<string, string> = {
  "participant id": "tg_id",
  "mentor id": "tg_id",
  "email": "email",
  "first name": "first_name",
  "last name": "last_name",
  "phone number": "phone",
  "profile type": "profile_type",
  "team name(s)": "team_name",
  "team name": "team_name",
  "team division": "team_division",
  "company name": "company_name",
  "school name": "school_name",
  "parent guardian name": "parent_name",
  "parent guardian email": "parent_email",
  "city": "city",
  "state": "state",
  "age": "age",
  "parental consent": "parental_consent",
  "media consent": "media_consent",
  "signed up": "signed_up_at",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

function mapCSVRowToDbFields(row: CSVRow, headers: string[]): Omit<ParsedRecord, '_csvRowIndex'> {
  const result: Omit<ParsedRecord, '_csvRowIndex'> = {};
  
  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);
    const dbField = CSV_FIELD_MAPPINGS[normalizedHeader];
    
    if (dbField && row[header] && row[header].trim() !== "" && row[header].trim() !== "-") {
      let value: any = row[header].trim();
      
      // Handle special conversions
      if (dbField === "age") {
        (result as any)[dbField] = parseInt(value) || null;
      } else if (dbField === "profile_type") {
        result.profile_type = value.toLowerCase() as ProfileType;
      } else if (dbField === "team_division") {
        // Normalize division to Title Case
        const divisionLower = value.toLowerCase();
        if (divisionLower === "beginner") result.team_division = "Beginner";
        else if (divisionLower === "junior") result.team_division = "Junior";
        else if (divisionLower === "senior") result.team_division = "Senior";
        else result.team_division = value;
      } else {
        (result as any)[dbField] = value;
      }
    }
  }
  
  return result;
}

export default function AdminImportUnified() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<{ headers: string[]; data: CSVRow[] } | null>(null);

  // Summary stats
  const [summaryData, setSummaryData] = useState({
    byProfileType: { student: 0, mentor: 0, judge: 0, chapter_ambassador: 0 } as Record<ProfileType, number>,
    byDivision: {} as Record<string, number>,
    totalRecords: 0,
    conflictsCount: 0,
    readyToImport: 0,
  });

  // Process CSV data and detect conflicts
  const processCSVData = useCallback(async (headers: string[], data: CSVRow[]) => {
    const records: ParsedRecord[] = data.map((row, index) => ({
      ...mapCSVRowToDbFields(row, headers),
      _csvRowIndex: index,
    }));

    // Calculate summary
    const byProfileType: Record<ProfileType, number> = { student: 0, mentor: 0, judge: 0, chapter_ambassador: 0 };
    const byDivision: Record<string, number> = {};
    
    for (const record of records) {
      const type = record.profile_type as ProfileType;
      if (type && byProfileType[type] !== undefined) {
        byProfileType[type]++;
      }
      
      if (type === "student" && record.team_division) {
        byDivision[record.team_division] = (byDivision[record.team_division] || 0) + 1;
      }
    }

    // Detect conflicts
    const emailCounts: Record<string, number[]> = {};
    records.forEach((record, index) => {
      if (record.email) {
        const emailLower = record.email.toLowerCase();
        if (!emailCounts[emailLower]) {
          emailCounts[emailLower] = [];
        }
        emailCounts[emailLower].push(index);
      }
    });

    // Get all unique emails from CSV
    const uniqueEmails = [...new Set(records.map(r => r.email?.toLowerCase()).filter(Boolean))];
    
    // Check against existing data in parallel batches
    const detectedConflicts: ConflictRecord[] = [];
    
    // Check for duplicates in CSV first
    for (const [email, indices] of Object.entries(emailCounts)) {
      if (indices.length > 1) {
        // Mark all but first as duplicates
        for (let i = 1; i < indices.length; i++) {
          const record = records[indices[i]];
          detectedConflicts.push({
            id: `dup-${indices[i]}`,
            conflictType: "duplicate_in_csv",
            email: email,
            firstName: record.first_name,
            lastName: record.last_name,
            profileType: record.profile_type || "student",
            teamName: record.team_name,
            teamDivision: record.team_division,
            duplicateRows: indices,
            csvRowIndex: indices[i],
            selected: false,
            action: "skip",
          });
        }
      }
    }

    // Check existing profiles (batch query)
    if (uniqueEmails.length > 0) {
      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("id, email, tg_email, first_name, last_name, verification_status")
        .or(uniqueEmails.map(e => `email.ilike.${e},tg_email.ilike.${e}`).join(","));

      const existingProfileEmails = new Set(
        existingProfiles?.flatMap(p => [p.email?.toLowerCase(), p.tg_email?.toLowerCase()].filter(Boolean)) || []
      );

      // Check existing authorized_users
      const { data: existingAuthorized } = await supabase
        .from("authorized_users")
        .select("id, email, matched_profile_id, first_name, last_name")
        .in("email", uniqueEmails);

      const authorizedMap = new Map(
        existingAuthorized?.map(a => [a.email.toLowerCase(), a]) || []
      );

      // Process each record for conflicts
      for (const record of records) {
        if (!record.email) continue;
        
        const emailLower = record.email.toLowerCase();
        
        // Skip if already marked as duplicate
        if (detectedConflicts.some(c => c.csvRowIndex === record._csvRowIndex)) {
          continue;
        }

        // Check if already active in platform
        if (existingProfileEmails.has(emailLower)) {
          detectedConflicts.push({
            id: `active-${record._csvRowIndex}`,
            conflictType: "already_active",
            email: emailLower,
            firstName: record.first_name,
            lastName: record.last_name,
            profileType: record.profile_type || "student",
            teamName: record.team_name,
            teamDivision: record.team_division,
            csvRowIndex: record._csvRowIndex,
            selected: false,
            action: "skip", // Always skip active users
          });
          continue;
        }

        // Check if already in whitelist
        const existingAuth = authorizedMap.get(emailLower);
        if (existingAuth && !existingAuth.matched_profile_id) {
          detectedConflicts.push({
            id: `whitelist-${record._csvRowIndex}`,
            conflictType: "already_in_whitelist",
            email: emailLower,
            firstName: record.first_name,
            lastName: record.last_name,
            profileType: record.profile_type || "student",
            teamName: record.team_name,
            teamDivision: record.team_division,
            existingData: {
              firstName: existingAuth.first_name || undefined,
              lastName: existingAuth.last_name || undefined,
            },
            csvRowIndex: record._csvRowIndex,
            selected: false,
            action: "update", // Default to update for whitelist conflicts
          });
        }
      }
    }

    setParsedRecords(records);
    setConflicts(detectedConflicts);
    setSummaryData({
      byProfileType,
      byDivision,
      totalRecords: records.length,
      conflictsCount: detectedConflicts.length,
      readyToImport: records.length - detectedConflicts.filter(c => c.action === "skip").length,
    });

    return detectedConflicts;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Por favor, selecciona un archivo CSV");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede superar los 10MB");
      return;
    }

    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const data = results.data as CSVRow[];
        
        // Validate required columns
        const hasEmail = headers.some(h => normalizeHeader(h).includes("email"));
        const hasProfileType = headers.some(h => normalizeHeader(h).includes("profile type"));
        
        if (!hasEmail) {
          setValidationErrors(["No se encontró una columna de Email."]);
          setStep("validation-error");
          return;
        }

        if (!hasProfileType) {
          setValidationErrors(["No se encontró la columna 'Profile type'. Este CSV no parece ser de Technovation Global."]);
          setStep("validation-error");
          return;
        }

        if (data.length > 5000) {
          setValidationErrors([`El archivo tiene ${data.length.toLocaleString()} filas. El máximo permitido es 5,000.`]);
          setStep("validation-error");
          return;
        }

        setCsvHeaders(headers);
        setCsvData(data);
        
        // Process and detect conflicts
        await processCSVData(headers, data);
        setStep("preview");
      },
      error: (error) => {
        toast.error(`Error al leer el archivo: ${error.message}`);
      },
    });
  }, [processCSVData]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const input = document.createElement("input");
      input.type = "file";
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      input.files = dataTransfer.files;
      handleFileUpload({ target: input } as any);
    }
  }, [handleFileUpload]);

  // Handle conflict action changes
  const handleConflictActionChange = useCallback((conflictId: string, action: ConflictRecord["action"]) => {
    setConflicts(prev => prev.map(c => 
      c.id === conflictId ? { ...c, action } : c
    ));
    
    // Update ready to import count
    setSummaryData(prev => ({
      ...prev,
      readyToImport: parsedRecords.length - conflicts.filter(c => 
        c.id === conflictId ? action === "skip" : c.action === "skip"
      ).length,
    }));
  }, [parsedRecords.length, conflicts]);

  const handleSelectAllSkip = useCallback((skip: boolean) => {
    setConflicts(prev => prev.map(c => 
      c.conflictType !== "already_active" ? { ...c, action: skip ? "skip" : "update" } : c
    ));
  }, []);

  // Process import
  const importMutation = useMutation({
    mutationFn: async () => {
      const importResult: ImportResult = {
        total: parsedRecords.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      };

      // Get records to process (excluding skipped conflicts)
      const skippedIndices = new Set(
        conflicts.filter(c => c.action === "skip" || c.conflictType === "already_active").map(c => c.csvRowIndex)
      );
      
      const recordsToProcess = parsedRecords.filter(r => !skippedIndices.has(r._csvRowIndex));
      importResult.skipped = parsedRecords.length - recordsToProcess.length;

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < recordsToProcess.length; i += batchSize) {
        const batch = recordsToProcess.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            const { _csvRowIndex, ...data } = record;
            
            if (!data.email) {
              importResult.errors.push({
                row: _csvRowIndex + 1,
                reason: "Email vacío",
                data: csvData[_csvRowIndex],
              });
              continue;
            }

            // Check if this is an update conflict
            const conflict = conflicts.find(c => c.csvRowIndex === _csvRowIndex);
            
            if (conflict?.conflictType === "already_in_whitelist" && conflict.action === "update") {
              // Update existing whitelist entry
              const { error } = await supabase
                .from("authorized_users")
                .update({
                  tg_id: data.tg_id,
                  profile_type: data.profile_type,
                  first_name: data.first_name,
                  last_name: data.last_name,
                  phone: data.phone,
                  company_name: data.company_name,
                  school_name: data.school_name,
                  team_name: data.team_name,
                  team_division: data.team_division,
                  parent_name: data.parent_name,
                  parent_email: data.parent_email,
                  city: data.city,
                  state: data.state,
                  age: data.age,
                  parental_consent: data.parental_consent,
                  media_consent: data.media_consent,
                  signed_up_at: data.signed_up_at,
                  updated_at: new Date().toISOString(),
                })
                .ilike("email", data.email);

              if (error) {
                importResult.errors.push({
                  row: _csvRowIndex + 1,
                  reason: `Error actualizando: ${error.message}`,
                  data: csvData[_csvRowIndex],
                });
              } else {
                importResult.updated++;
              }
            } else {
              // Insert new record
              const { error } = await supabase
                .from("authorized_users")
                .insert({
                  email: data.email.toLowerCase(),
                  tg_id: data.tg_id,
                  profile_type: data.profile_type || "student",
                  first_name: data.first_name,
                  last_name: data.last_name,
                  phone: data.phone,
                  company_name: data.company_name,
                  school_name: data.school_name,
                  team_name: data.team_name,
                  team_division: data.team_division,
                  parent_name: data.parent_name,
                  parent_email: data.parent_email,
                  city: data.city,
                  state: data.state,
                  age: data.age,
                  parental_consent: data.parental_consent,
                  media_consent: data.media_consent,
                  signed_up_at: data.signed_up_at,
                });

              if (error) {
                if (error.code === "23505") {
                  // Unique violation - try update instead
                  importResult.skipped++;
                } else {
                  importResult.errors.push({
                    row: _csvRowIndex + 1,
                    reason: `Error insertando: ${error.message}`,
                    data: csvData[_csvRowIndex],
                  });
                }
              } else {
                importResult.created++;
              }
            }
          } catch (err: any) {
            importResult.errors.push({
              row: record._csvRowIndex + 1,
              reason: err.message,
              data: csvData[record._csvRowIndex],
            });
          }
        }

        setProgress(Math.round(((i + batch.length) / recordsToProcess.length) * 100));
      }

      // Log import
      await supabase.from("csv_imports").insert({
        file_name: file?.name || "unknown",
        uploaded_by: user?.id,
        status: importResult.errors.length > 0 ? "completed" : "completed",
        records_processed: importResult.total,
        records_new: importResult.created,
        records_updated: importResult.updated,
        errors: importResult.errors.length > 0 ? { errors: importResult.errors.slice(0, 100) } : null,
      });

      return importResult;
    },
    onSuccess: (result) => {
      setResult(result);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
      toast.success(`Importación completada: ${result.created} nuevos, ${result.updated} actualizados`);
    },
    onError: (error: Error) => {
      toast.error(`Error en la importación: ${error.message}`);
    },
  });

  const handleStartImport = () => {
    setStep("processing");
    setProgress(0);
    importMutation.mutate();
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setParsedRecords([]);
    setConflicts([]);
    setProgress(0);
    setResult(null);
    setValidationErrors([]);
  };

  const downloadErrorsCSV = () => {
    if (!result?.errors.length) return;
    
    const errorData = result.errors.map(e => ({
      Fila: e.row,
      Error: e.reason,
      ...e.data,
    }));
    
    const csv = Papa.unparse(errorData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `errores-importacion-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar Usuarios</h1>
          <p className="text-muted-foreground">
            Importa estudiantes, mentores y jueces desde un CSV de Technovation Global
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {["upload", "preview", "conflicts", "processing", "results"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium",
                step === s ? "bg-primary text-primary-foreground" :
                ["preview", "conflicts", "processing", "results"].indexOf(step) > i 
                  ? "bg-primary/20 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              {i < 4 && <div className="w-8 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        {/* Upload Step */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Subir CSV de Technovation Global
              </CardTitle>
              <CardDescription>
                Arrastra el archivo CSV o haz clic para seleccionarlo. 
                El sistema detectará automáticamente estudiantes, mentores y jueces.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Arrastra tu archivo CSV aquí</p>
                <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Error Step */}
        {step === "validation-error" && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Error de Validación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationErrors.map((error, i) => (
                <Alert key={i} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
              <Button variant="outline" onClick={handleReset}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a intentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <div className="space-y-6">
            <ImportSummaryCard data={summaryData} />

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleReset}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={() => conflicts.length > 0 ? setStep("conflicts") : handleStartImport()}>
                {conflicts.length > 0 ? (
                  <>
                    Revisar {conflicts.length} conflictos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Importar {summaryData.totalRecords} registros
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Conflicts Step */}
        {step === "conflicts" && (
          <ConflictResolver
            conflicts={conflicts}
            onConflictActionChange={handleConflictActionChange}
            onSelectAllSkip={handleSelectAllSkip}
            onContinue={handleStartImport}
            onBack={() => setStep("preview")}
          />
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Importando...
              </CardTitle>
              <CardDescription>
                Por favor, no cierres esta ventana mientras se procesa la importación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-3" />
              <p className="text-center text-sm text-muted-foreground">
                {progress}% completado
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results Step */}
        {step === "results" && result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Importación Completada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-sm text-muted-foreground">Total procesados</div>
                </div>
                <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/30 text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{result.created}</div>
                  <div className="text-sm text-muted-foreground">Nuevos</div>
                </div>
                <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-center">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.updated}</div>
                  <div className="text-sm text-muted-foreground">Actualizados</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">{result.skipped}</div>
                  <div className="text-sm text-muted-foreground">Ignorados</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{result.errors.length} errores durante la importación</AlertTitle>
                  <AlertDescription>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={downloadErrorsCSV}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Descargar errores como CSV
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleReset} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Nueva importación
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
