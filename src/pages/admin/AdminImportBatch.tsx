import { useState, useCallback } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
interface CsvPreview {
  fileName: string;
  totalRows: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  breakdown: Record<string, number>;
}

type Step = "upload" | "preview" | "processing" | "done";

// ─── Constants ──────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Component ──────────────────────────────────────────────────────
export default function AdminImportBatch() {
  const { session, user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const [teamsFile, setTeamsFile] = useState<File | null>(null);
  const [usersPreview, setUsersPreview] = useState<CsvPreview | null>(null);
  const [teamsPreview, setTeamsPreview] = useState<CsvPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── File Validation ────────────────────────────────────────────
  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith(".csv")) return "El archivo debe ser .csv";
    if (file.size > MAX_FILE_SIZE) return "El archivo excede el límite de 10MB";
    return null;
  };

  const handleFileSelect = (
    file: File | null,
    type: "users" | "teams"
  ) => {
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    if (type === "users") setUsersFile(file);
    else setTeamsFile(file);
  };

  // ─── Preview Generation ─────────────────────────────────────────
  const generatePreview = useCallback(async () => {
    if (!usersFile && !teamsFile) {
      toast.error("Debes seleccionar al menos un archivo CSV");
      return;
    }

    if (usersFile) {
      const parsed = await parseFile(usersFile);
      const breakdown: Record<string, number> = {};
      for (const row of parsed.data as Record<string, string>[]) {
        const profileType =
          row["Profile type"] || row["profile_type"] || "unknown";
        breakdown[profileType] = (breakdown[profileType] || 0) + 1;
      }
      setUsersPreview({
        fileName: usersFile.name,
        totalRows: parsed.data.length,
        headers: parsed.meta.fields || [],
        sampleRows: (parsed.data as Record<string, string>[]).slice(0, 5),
        breakdown,
      });
    }

    if (teamsFile) {
      const parsed = await parseFile(teamsFile);
      const breakdown: Record<string, number> = {};
      for (const row of parsed.data as Record<string, string>[]) {
        const division = row["Division"] || row["division"] || "unknown";
        breakdown[division] = (breakdown[division] || 0) + 1;
      }
      setTeamsPreview({
        fileName: teamsFile.name,
        totalRows: parsed.data.length,
        headers: parsed.meta.fields || [],
        sampleRows: (parsed.data as Record<string, string>[]).slice(0, 5),
        breakdown,
      });
    }

    setStep("preview");
  }, [usersFile, teamsFile]);

  // ─── Start Import ───────────────────────────────────────────────
  const startImport = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Check for existing pending/processing imports
      const { data: activeImports } = await supabase
        .from("csv_imports")
        .select("id, status")
        .in("status", ["pending", "processing"]);

      if (activeImports && activeImports.length > 0) {
        toast.error(
          "Ya hay una importación en proceso. Espera a que termine antes de iniciar otra."
        );
        setIsSubmitting(false);
        return;
      }

      // Create csv_imports record
      const importType = [
        usersFile ? "users" : "",
        teamsFile ? "teams" : "",
      ]
        .filter(Boolean)
        .join("+");

      const { data: importRecord, error: insertErr } = await supabase
        .from("csv_imports")
        .insert({
          file_name: [usersFile?.name, teamsFile?.name]
            .filter(Boolean)
            .join(", "),
          uploaded_by: user?.id,
          status: "pending",
          import_type: importType,
          admin_email: user?.email,
        } as Record<string, unknown>)
        .select("id")
        .single();

      if (insertErr || !importRecord) {
        throw new Error(
          `Error al crear registro de importación: ${insertErr?.message}`
        );
      }

      const importId = importRecord.id;

      // Upload files to storage
      const storagePaths: { users_csv?: string; teams_csv?: string } = {};

      if (usersFile) {
        const path = `imports/${importId}/${usersFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("csv-imports")
          .upload(path, usersFile);
        if (upErr) throw new Error(`Error subiendo CSV de usuarios: ${upErr.message}`);
        storagePaths.users_csv = path;
      }

      if (teamsFile) {
        const path = `imports/${importId}/${teamsFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("csv-imports")
          .upload(path, teamsFile);
        if (upErr) throw new Error(`Error subiendo CSV de equipos: ${upErr.message}`);
        storagePaths.teams_csv = path;
      }

      // Update storage paths
      await supabase
        .from("csv_imports")
        .update({ storage_paths: storagePaths } as Record<string, unknown>)
        .eq("id", importId);

      // Invoke Edge Function — check for invocation-level failures
      const { error: invokeError } = await supabase.functions.invoke(
        "process-csv-import",
        { body: { importId } }
      );

      if (invokeError) {
        // Mark import as failed so it doesn't stay in limbo
        await supabase
          .from("csv_imports")
          .update({ status: "failed", errors: [{ error: invokeError.message }] } as Record<string, unknown>)
          .eq("id", importId);
        throw new Error(`Error al invocar la función: ${invokeError.message}`);
      }

      setStep("done");
      toast.success("Importación iniciada correctamente");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  // ─── Reset ──────────────────────────────────────────────────────
  const reset = () => {
    setStep("upload");
    setUsersFile(null);
    setTeamsFile(null);
    setUsersPreview(null);
    setTeamsPreview(null);
    setIsSubmitting(false);
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <AdminLayout title="Importar Usuarios y Equipos">
      <div className="max-w-4xl mx-auto space-y-6">
        {step === "upload" && (
          <UploadStep
            usersFile={usersFile}
            teamsFile={teamsFile}
            onSelectFile={handleFileSelect}
            onContinue={generatePreview}
          />
        )}

        {step === "preview" && (
          <PreviewStep
            usersPreview={usersPreview}
            teamsPreview={teamsPreview}
            isSubmitting={isSubmitting}
            onBack={() => setStep("upload")}
            onStart={startImport}
          />
        )}

        {step === "done" && (
          <DoneStep
            adminEmail={user?.email || ""}
            onReset={reset}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Upload Step ────────────────────────────────────────────────────
function UploadStep({
  usersFile,
  teamsFile,
  onSelectFile,
  onContinue,
}: {
  usersFile: File | null;
  teamsFile: File | null;
  onSelectFile: (file: File | null, type: "users" | "teams") => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FileUploadCard
          title="CSV de Usuarios"
          description="Archivo de usuarios exportado desde Technovation Global"
          file={usersFile}
          onSelect={(f) => onSelectFile(f, "users")}
        />
        <FileUploadCard
          title="CSV de Equipos"
          description="Archivo de equipos exportado desde Technovation Global"
          file={teamsFile}
          onSelect={(f) => onSelectFile(f, "teams")}
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onContinue}
          disabled={!usersFile && !teamsFile}
          size="lg"
        >
          Continuar a Vista Previa
        </Button>
      </div>
    </>
  );
}

// ─── File Upload Card ───────────────────────────────────────────────
function FileUploadCard({
  title,
  description,
  file,
  onSelect,
}: {
  title: string;
  description: string;
  file: File | null;
  onSelect: (file: File | null) => void;
}) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) onSelect(dropped);
    },
    [onSelect]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".csv";
            input.onchange = () => {
              if (input.files?.[0]) onSelect(input.files[0]);
            };
            input.click();
          }}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arrastra un archivo o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground">.csv, máx 10MB</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Preview Step ───────────────────────────────────────────────────
function PreviewStep({
  usersPreview,
  teamsPreview,
  isSubmitting,
  onBack,
  onStart,
}: {
  usersPreview: CsvPreview | null;
  teamsPreview: CsvPreview | null;
  isSubmitting: boolean;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <>
      {usersPreview && (
        <PreviewCard
          title="CSV de Usuarios"
          preview={usersPreview}
          breakdownLabel="Por tipo de perfil"
          sampleColumns={["Email", "First name", "Last name", "Profile type"]}
        />
      )}

      {teamsPreview && (
        <PreviewCard
          title="CSV de Equipos"
          preview={teamsPreview}
          breakdownLabel="Por división"
          sampleColumns={["Name", "Division", "Student emails"]}
        />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button onClick={onStart} disabled={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando...
            </>
          ) : (
            "Iniciar Importación"
          )}
        </Button>
      </div>
    </>
  );
}

// ─── Preview Card ───────────────────────────────────────────────────
function PreviewCard({
  title,
  preview,
  breakdownLabel,
  sampleColumns,
}: {
  title: string;
  preview: CsvPreview;
  breakdownLabel: string;
  sampleColumns: string[];
}) {
  // Find actual column names (case-insensitive match)
  const resolvedColumns = sampleColumns.map((col) => {
    const found = preview.headers.find(
      (h) => h.toLowerCase() === col.toLowerCase()
    );
    return found || col;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          {preview.fileName} — {preview.totalRows} filas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Breakdown */}
        <div>
          <p className="text-sm font-medium mb-2">{breakdownLabel}:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(preview.breakdown).map(([key, count]) => (
              <span
                key={key}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
              >
                {key}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Sample rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {resolvedColumns.map((col) => (
                  <th
                    key={col}
                    className="text-left py-2 px-2 font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {resolvedColumns.map((col) => (
                    <td key={col} className="py-2 px-2 truncate max-w-[200px]">
                      {row[col] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Done Step ──────────────────────────────────────────────────────
function DoneStep({
  adminEmail,
  onReset,
}: {
  adminEmail: string;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
        <h2 className="text-xl font-semibold">Importación en proceso</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Tu importación se está procesando. Recibirás un email en{" "}
          <strong>{adminEmail}</strong> cuando termine. Puedes salir de esta
          página con seguridad.
        </p>
        <Button variant="outline" onClick={onReset} className="mt-4">
          Nueva Importación
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────
function parseFile(
  file: File
): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    });
  });
}
