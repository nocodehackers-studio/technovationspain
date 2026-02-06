import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Check, X, Camera, AlertTriangle, CalendarX, UserX, SwitchCamera, Flashlight, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { useTicketValidation, type ValidationError } from '@/hooks/useTicketValidation';

export default function ValidatePage() {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();

  // Admin and volunteer access: redirect others to home
  useEffect(() => {
    if (!authLoading && (!user || !['admin', 'volunteer'].includes(role || ''))) {
      navigate('/', { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  // Show loading while checking auth
  if (authLoading) {
    return <LoadingPage message="Verificando acceso..." />;
  }

  // Don't render anything while redirecting unauthorized users
  if (!user || !['admin', 'volunteer'].includes(role || '')) {
    return null;
  }

  // Render appropriate mode
  if (code) {
    return <ResultMode code={code} />;
  }

  return <ScannerMode />;
}

// Scanner Mode Component
function ScannerMode() {
  const navigate = useNavigate();
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isInitializedRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  const extractCode = useCallback((decodedText: string): string => {
    try {
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const validateIndex = pathParts.indexOf('validate');
      if (validateIndex !== -1 && pathParts.length > validateIndex + 1) {
        return pathParts[validateIndex + 1];
      }
    } catch {
      // Not a URL, use as-is
    }
    return decodedText;
  }, []);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader-video');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (hasNavigatedRef.current) return;
            hasNavigatedRef.current = true;

            const code = extractCode(decodedText);
            scanner.stop().then(() => {
              navigate(`/validate/${code}`);
            }).catch(() => {
              navigate(`/validate/${code}`);
            });
          },
          () => {
            // Ignore continuous scan errors
          }
        );

        setIsStarting(false);
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setScannerError('No se pudo acceder a la cámara. Por favor, permite el acceso en los ajustes del navegador.');
        } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
          setScannerError('No se encontró ninguna cámara en este dispositivo.');
        } else {
          setScannerError('No se pudo inicializar el escáner. Verifica los permisos de la cámara.');
        }
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [navigate, extractCode]);

  const handleRetry = () => {
    setScannerError(null);
    isInitializedRef.current = false;
    hasNavigatedRef.current = false;
    window.location.reload();
  };

  if (scannerError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Camera className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-lg text-center text-muted-foreground mb-6 max-w-sm" role="alert">
          {scannerError}
        </p>
        <Button onClick={handleRetry}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      {/* Camera viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        <div id="qr-reader-video" className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />

        {/* Overlay with cutout */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar */}
          <div className="bg-black/60 backdrop-blur-sm px-4 py-6 text-center">
            <h1 className="text-lg font-semibold text-white">Escanear entrada</h1>
            <p className="text-sm text-white/70 mt-1">
              Apunta la cámara al código QR
            </p>
          </div>

          {/* Scan frame centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 relative">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

              {/* Scanning line animation */}
              {!isStarting && (
                <div className="absolute left-2 right-2 h-0.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-scan-line" />
              )}
            </div>
          </div>

          {/* Bottom area */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-4 py-8 text-center">
            {isStarting ? (
              <div className="flex items-center justify-center gap-2 text-white/70">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                <span className="text-sm">Iniciando cámara...</span>
              </div>
            ) : (
              <p className="text-sm text-white/50">
                La entrada se validará automáticamente
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Error display configuration
const ERROR_CONFIG: Record<ValidationError, { icon: typeof X; title: string; description: string; bgClass: string; textClass: string }> = {
  not_found: {
    icon: UserX,
    title: 'No encontrado',
    description: 'Este código QR no corresponde a ninguna entrada registrada.',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700'
  },
  already_checked_in: {
    icon: AlertTriangle,
    title: 'Ya registrado',
    description: 'Esta entrada ya ha sido utilizada anteriormente.',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700'
  },
  wrong_date: {
    icon: CalendarX,
    title: 'Fecha incorrecta',
    description: 'Esta entrada no corresponde al evento de hoy.',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700'
  },
  cancelled: {
    icon: X,
    title: 'Cancelada',
    description: 'Esta inscripción ha sido cancelada.',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700'
  },
  waitlisted: {
    icon: Clock,
    title: 'En lista de espera',
    description: 'Esta entrada está en lista de espera y no puede acceder al evento.',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-700'
  },
  consent_not_given: {
    icon: ShieldAlert,
    title: 'Consentimiento pendiente',
    description: 'Esta entrada requiere consentimiento firmado antes de poder acceder al evento.',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700'
  }
};

// Result Mode Component
function ResultMode({ code }: { code: string }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useTicketValidation(code);

  const handleBackToScanner = () => {
    navigate('/validate');
  };

  // Loading state
  if (isLoading) {
    return <LoadingPage message="Verificando entrada..." />;
  }

  // Network/API error
  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center px-4" role="alert">
        <X className="h-24 w-24 text-red-600 mb-4" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-red-700 mb-4">Error de conexión</h1>
        <p className="text-red-600 mb-8 text-center max-w-sm">
          No se pudo verificar la entrada. Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-100"
          onClick={handleBackToScanner}
        >
          Volver al scanner
        </Button>
      </div>
    );
  }

  // Valid ticket - Success state
  if (data?.valid && data.registration) {
    const reg = data.registration;
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-4" role="status" aria-live="polite">
        <Check className="h-24 w-24 text-green-600 mb-4" aria-hidden="true" />
        <h1 className="text-4xl font-bold text-green-700 mb-8">
          <span className="sr-only">Entrada válida: </span>
          Válido
        </h1>

        <div className="w-full max-w-sm space-y-3 text-center">
          <div className="border-t border-green-200 pt-4">
            <p className="text-lg font-medium text-green-800">
              {reg.display_name}
            </p>
            <p className="text-sm text-green-600">
              {reg.ticket_type}
              {reg.is_companion && ' (Acompañante)'}
            </p>
            <p className="text-sm text-green-600">{reg.event_name}</p>
            {reg.team_name && (
              <p className="text-sm text-green-600 mt-1">
                Equipo: {reg.team_name}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          className="mt-8 border-green-300 text-green-700 hover:bg-green-100"
          onClick={handleBackToScanner}
        >
          Volver al scanner
        </Button>
      </div>
    );
  }

  // Invalid ticket - Error state
  const validationError = data?.error || 'not_found';
  const config = ERROR_CONFIG[validationError];
  const ErrorIcon = config.icon;
  const errorRegistration = data?.registration;

  return (
    <div className={`min-h-screen ${config.bgClass} flex flex-col items-center justify-center px-4`} role="alert" aria-live="assertive">
      <ErrorIcon className={`h-24 w-24 ${config.textClass.replace('text-', 'text-')} mb-4`} aria-hidden="true" />
      <h1 className={`text-3xl font-bold ${config.textClass} mb-4`}>
        <span className="sr-only">Error: </span>
        {config.title}
      </h1>

      {/* Show participant info for consent_not_given and waitlisted */}
      {errorRegistration && (validationError === 'consent_not_given' || validationError === 'waitlisted') && (
        <div className="w-full max-w-sm mb-4 text-center">
          <p className={`text-lg font-medium ${config.textClass}`}>
            {errorRegistration.display_name}
          </p>
          <p className={`text-sm ${config.textClass.replace('-700', '-600')}`}>
            {errorRegistration.ticket_type} — {errorRegistration.event_name}
          </p>
        </div>
      )}

      <p className={`${config.textClass.replace('-700', '-600')} mb-8 text-center max-w-sm`}>
        {config.description}
      </p>
      <Button
        variant="outline"
        className={`border-${config.textClass.replace('text-', '')}-300 ${config.textClass} hover:${config.bgClass.replace('bg-', 'bg-')}`}
        onClick={handleBackToScanner}
      >
        Volver al scanner
      </Button>
    </div>
  );
}
