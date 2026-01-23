import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, ArrowLeft, ArrowRight, Users, UserPlus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { VerificationStatus } from "@/types/database";

type ImportStep = "upload" | "preview" | "processing" | "results";

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data: CSVRow }[];
}

// Database fields for mapping - extended for Technovation CSV
const dbFields = [
  { value: "email", label: "Email (principal)" },
  { value: "first_name", label: "Nombre" },
  { value: "last_name", label: "Apellidos" },
  { value: "tg_id", label: "ID Technovation" },
  { value: "phone", label: "Teléfono" },
  { value: "parent_name", label: "Nombre tutor/a" },
  { value: "parent_email", label: "Email tutor/a" },
  { value: "team_name", label: "Nombre equipo" },
  { value: "team_division", label: "División equipo" },
  { value: "school_name", label: "Centro educativo" },
  { value: "city", label: "Ciudad" },
  { value: "state", label: "Comunidad/Estado" },
  { value: "age", label: "Edad" },
  { value: "parental_consent", label: "Consentimiento parental" },
  { value: "media_consent", label: "Consentimiento medios" },
  { value: "signed_up_at", label: "Fecha registro TG" },
  { value: "skip", label: "— Ignorar —" },
];

export default function AdminImportCSV() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [options, setOptions] = useState({
    updateExisting: true,
    autoVerifyRegistered: true,
  });
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Auto-detect column mappings based on Technovation CSV headers
  const autoDetectMappings = (headers: string[]): ColumnMapping[] => {
    const mappingRules: Record<string, string[]> = {
      email: ["email", "correo", "e-mail", "mail"],
      first_name: ["first name", "first_name", "nombre", "firstname"],
      last_name: ["last name", "last_name", "apellidos", "surname", "lastname", "apellido"],
      tg_id: ["participant id", "participant_id", "tg_id", "technovation_id", "mentor id"],
      phone: ["phone number", "phone", "telefono", "teléfono", "mobile", "tel"],
      parent_name: ["parent guardian name", "parent_name", "tutor", "guardian name"],
      parent_email: ["parent guardian email", "parent_email", "tutor email", "guardian email"],
      team_name: ["team name", "team name(s)", "team_name", "equipo"],
      team_division: ["team division", "division", "categoría", "category"],
      school_name: ["school name", "school", "colegio", "centro", "institución"],
      city: ["city", "ciudad", "localidad"],
      state: ["state", "comunidad", "provincia", "region"],
      age: ["age", "edad"],
      parental_consent: ["parental consent", "consentimiento parental"],
      media_consent: ["media consent", "consentimiento medios", "image consent"],
      signed_up_at: ["signed up", "signup date", "fecha registro", "registration date"],
    };

    return headers.map((header) => {
      const headerLower = header.toLowerCase().trim();
      let matchedField = "skip";

      for (const [field, patterns] of Object.entries(mappingRules)) {
        if (patterns.some((p) => headerLower.includes(p) || headerLower === p)) {
          matchedField = field;
          break;
        }
      }

      return { csvColumn: header, dbField: matchedField };
    });
  };

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
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
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as CSVRow[]);
        setColumnMappings(autoDetectMappings(headers));
        setStep("preview");
      },
      error: (error) => {
        toast.error(`Error al leer el archivo: ${error.message}`);
      },
    });
  }, []);

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

  // Process import
  const importMutation = useMutation({
    mutationFn: async () => {
      const importResult: ImportResult = {
        total: csvData.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      };

      // Create a mapping from csv columns to db fields
      const fieldMap: Record<string, string> = {};
      columnMappings.forEach((m) => {
        if (m.dbField !== "skip") {
          fieldMap[m.csvColumn] = m.dbField;
        }
      });

      // Find email column
      const emailColumn = columnMappings.find((m) => m.dbField === "email")?.csvColumn;
      if (!emailColumn) {
        throw new Error("Debe mapear una columna como Email");
      }

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        setProgress(Math.round(((i + 1) / csvData.length) * 100));

        try {
          const email = row[emailColumn]?.trim().toLowerCase();
          if (!email) {
            importResult.errors.push({
              row: i + 1,
              reason: "Email vacío",
              data: row,
            });
            continue;
          }

          // Build data object from CSV
          const studentData: Record<string, any> = { email };
          for (const [csvCol, dbField] of Object.entries(fieldMap)) {
            if (row[csvCol] && row[csvCol].trim() !== "-") {
              const value = row[csvCol].trim();
              
              // Handle special field conversions
              if (dbField === "age") {
                studentData[dbField] = parseInt(value) || null;
              } else if (dbField === "signed_up_at") {
                // Parse date format YYYY-MM-DD
                studentData[dbField] = value || null;
              } else {
                studentData[dbField] = value;
              }
            }
          }

          // 1. Check if student is already in authorized_students
          const { data: existingAuthorized } = await supabase
            .from("authorized_students")
            .select("id, matched_profile_id")
            .eq("email", email)
            .maybeSingle();

          // 2. Check if student has a profile in profiles table
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id, email, verification_status")
            .or(`email.eq.${email},tg_email.eq.${email}`)
            .maybeSingle();

          if (existingProfile) {
            // Student already registered - update and verify if option enabled
            if (options.updateExisting) {
              const updateData: Record<string, any> = {
                tg_id: studentData.tg_id,
                tg_email: email,
                first_name: studentData.first_name,
                last_name: studentData.last_name,
                phone: studentData.phone,
              };
              
              if (options.autoVerifyRegistered) {
                updateData.verification_status = "verified" as VerificationStatus;
              }

              const { error: updateError } = await supabase
                .from("profiles")
                .update(updateData)
                .eq("id", existingProfile.id);

              if (updateError) {
                importResult.errors.push({
                  row: i + 1,
                  reason: `Error actualizando perfil: ${updateError.message}`,
                  data: row,
                });
              } else {
                importResult.updated++;

                // Also update/create authorized_students entry if not exists
                if (!existingAuthorized) {
                  await supabase.from("authorized_students").insert([{
                    email: studentData.email,
                    tg_id: studentData.tg_id,
                    first_name: studentData.first_name,
                    last_name: studentData.last_name,
                    phone: studentData.phone,
                    parent_name: studentData.parent_name,
                    parent_email: studentData.parent_email,
                    team_name: studentData.team_name,
                    team_division: studentData.team_division,
                    school_name: studentData.school_name,
                    city: studentData.city,
                    state: studentData.state,
                    age: studentData.age,
                    parental_consent: studentData.parental_consent,
                    media_consent: studentData.media_consent,
                    signed_up_at: studentData.signed_up_at,
                    matched_profile_id: existingProfile.id,
                  }]);
                } else {
                  await supabase.from("authorized_students")
                    .update({ 
                      tg_id: studentData.tg_id,
                      first_name: studentData.first_name,
                      last_name: studentData.last_name,
                      phone: studentData.phone,
                      parent_name: studentData.parent_name,
                      parent_email: studentData.parent_email,
                      team_name: studentData.team_name,
                      team_division: studentData.team_division,
                      school_name: studentData.school_name,
                      city: studentData.city,
                      state: studentData.state,
                      age: studentData.age,
                      parental_consent: studentData.parental_consent,
                      media_consent: studentData.media_consent,
                      signed_up_at: studentData.signed_up_at,
                      matched_profile_id: existingProfile.id 
                    })
                    .eq("id", existingAuthorized.id);
                }
              }
            } else {
              importResult.skipped++;
            }
          } else if (existingAuthorized) {
            // Already in whitelist but not registered yet - update data
            if (options.updateExisting) {
              const { error: updateError } = await supabase
                .from("authorized_students")
                .update(studentData)
                .eq("id", existingAuthorized.id);

              if (updateError) {
                importResult.errors.push({
                  row: i + 1,
                  reason: `Error actualizando whitelist: ${updateError.message}`,
                  data: row,
                });
              } else {
                importResult.skipped++; // Already existed, just updated
              }
            } else {
              importResult.skipped++;
            }
          } else {
            // New student - add to whitelist
            const { error: insertError } = await supabase
              .from("authorized_students")
              .insert([{
                email: studentData.email,
                tg_id: studentData.tg_id,
                first_name: studentData.first_name,
                last_name: studentData.last_name,
                phone: studentData.phone,
                parent_name: studentData.parent_name,
                parent_email: studentData.parent_email,
                team_name: studentData.team_name,
                team_division: studentData.team_division,
                school_name: studentData.school_name,
                city: studentData.city,
                state: studentData.state,
                age: studentData.age,
                parental_consent: studentData.parental_consent,
                media_consent: studentData.media_consent,
                signed_up_at: studentData.signed_up_at,
              }]);

            if (insertError) {
              importResult.errors.push({
                row: i + 1,
                reason: `Error añadiendo a whitelist: ${insertError.message}`,
                data: row,
              });
            } else {
              importResult.created++;
            }
          }
        } catch (error: any) {
          importResult.errors.push({
            row: i + 1,
            reason: error.message || "Error desconocido",
            data: row,
          });
        }
      }

      // Log the import
      await supabase.from("csv_imports").insert({
        uploaded_by: user?.id,
        file_name: file?.name || "unknown.csv",
        status: importResult.errors.length === importResult.total ? "failed" : "completed",
        records_processed: importResult.total,
        records_updated: importResult.updated,
        records_new: importResult.created,
        errors: importResult.errors.length > 0 ? importResult.errors : null,
      });

      return importResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["authorized-students"] });
    },
    onError: (error) => {
      toast.error(`Error en la importación: ${error.message}`);
      setStep("preview");
    },
  });

  const handleStartImport = () => {
    setStep("processing");
    setProgress(0);
    importMutation.mutate();
  };

  const resetImport = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMappings([]);
    setProgress(0);
    setResult(null);
  };

  return (
    <AdminLayout title="Importar Estudiantes">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {["upload", "preview", "processing", "results"].map((s, i) => (
            <div key={s} className="flex items-center gap-1 sm:gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["upload", "preview", "processing", "results"].indexOf(step) > i
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </div>
              {i < 3 && <div className="h-0.5 w-4 sm:w-8 bg-muted" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card>
            <CardHeader className="pb-2 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Importar Estudiantes de Technovation</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Sube el CSV exportado desde Technovation Global. Los estudiantes nuevos se añadirán a la whitelist 
                y podrán acceder automáticamente cuando se registren con su email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-lg p-6 sm:p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg font-medium mb-2">
                  Arrastra y suelta tu archivo CSV aquí
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  o haz clic para seleccionar un archivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Máximo 10MB, formato .csv
                </p>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Info about the process */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-medium text-sm">¿Cómo funciona?</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <UserPlus className="h-4 w-4 mt-0.5 text-success" />
                    <span><strong>Nuevos estudiantes:</strong> Se añaden a la whitelist. Cuando se registren con su email, tendrán acceso automático.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 mt-0.5 text-primary" />
                    <span><strong>Estudiantes existentes:</strong> Se actualizan sus datos y se verifican automáticamente.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span><strong>Ya en whitelist:</strong> Se actualizan sus datos si hay cambios.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <Card>
            <CardHeader>
              <CardTitle>Previsualización y Mapeo</CardTitle>
              <CardDescription>
                Verifica el mapeo de columnas y las primeras filas del archivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{file?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {csvData.length} estudiantes encontrados
                  </p>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="space-y-4">
                <h3 className="font-medium">Mapeo de Columnas</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {columnMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[140px] truncate" title={mapping.csvColumn}>
                        {mapping.csvColumn}
                      </span>
                      <span>→</span>
                      <Select
                        value={mapping.dbField}
                        onValueChange={(value) => {
                          const newMappings = [...columnMappings];
                          newMappings[index].dbField = value;
                          setColumnMappings(newMappings);
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dbFields.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <h3 className="font-medium">Vista Previa (primeras 5 filas)</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.slice(0, 6).map((header) => (
                          <TableHead key={header} className="whitespace-nowrap">
                            {header}
                          </TableHead>
                        ))}
                        {csvHeaders.length > 6 && (
                          <TableHead className="whitespace-nowrap text-muted-foreground">
                            +{csvHeaders.length - 6} más
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {csvHeaders.slice(0, 6).map((header) => (
                            <TableCell key={header} className="whitespace-nowrap max-w-[150px] truncate">
                              {row[header] || "—"}
                            </TableCell>
                          ))}
                          {csvHeaders.length > 6 && (
                            <TableCell className="text-muted-foreground">...</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <h3 className="font-medium">Opciones de Importación</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="updateExisting"
                      checked={options.updateExisting}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, updateExisting: !!checked })
                      }
                    />
                    <Label htmlFor="updateExisting">
                      Actualizar datos de estudiantes que ya existen
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="autoVerifyRegistered"
                      checked={options.autoVerifyRegistered}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, autoVerifyRegistered: !!checked })
                      }
                    />
                    <Label htmlFor="autoVerifyRegistered">
                      Verificar automáticamente estudiantes ya registrados
                    </Label>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={resetImport}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
                <Button onClick={handleStartImport}>
                  Procesar Importación
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <Card>
            <CardHeader>
              <CardTitle>Procesando Importación</CardTitle>
              <CardDescription>
                Por favor, espera mientras procesamos los registros
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-lg font-medium">Procesando estudiantes...</p>
                <p className="text-sm text-muted-foreground">
                  {Math.round(progress)}% completado
                </p>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {step === "results" && result && (
          <Card>
            <CardHeader>
              <CardTitle>Importación Completada</CardTitle>
              <CardDescription>
                Resumen de la importación de estudiantes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-sm text-muted-foreground">Total procesados</p>
                </div>
                <div className="p-4 bg-success/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-success">{result.created}</p>
                  <p className="text-sm text-muted-foreground">Nuevos en whitelist</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">{result.updated}</p>
                  <p className="text-sm text-muted-foreground">Actualizados</p>
                </div>
                <div className="p-4 bg-destructive/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-destructive">{result.errors.length}</p>
                  <p className="text-sm text-muted-foreground">Errores</p>
                </div>
              </div>

              {/* Success Message */}
              {result.errors.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                  <div>
                    <p className="font-medium text-success">¡Importación exitosa!</p>
                    <p className="text-sm text-muted-foreground">
                      Todos los estudiantes han sido procesados correctamente.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-warning/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-warning" />
                  <div>
                    <p className="font-medium text-warning">Importación completada con errores</p>
                    <p className="text-sm text-muted-foreground">
                      Algunos registros no pudieron ser procesados.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Errores ({result.errors.length})
                  </h3>
                  <div className="border rounded-lg overflow-auto max-h-60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Fila</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((error, i) => {
                          const emailColumn = columnMappings.find((m) => m.dbField === "email")?.csvColumn;
                          return (
                            <TableRow key={i}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell className="text-destructive">{error.reason}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {emailColumn ? error.data[emailColumn] : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={resetImport}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar otro archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
