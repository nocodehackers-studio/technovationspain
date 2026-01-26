import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Check, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  useTicketLookup,
  useCheckIn,
  validateTicket,
} from '@/hooks/useTicketValidation';

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
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
    };

    try {
      const scanner = new Html5QrcodeScanner('qr-reader', config, false);
      scannerRef.current = scanner;

      const onScanSuccess = (decodedText: string) => {
        // Extract code from URL (e.g., https://example.com/validate/TGM-2026-XXXXXXXX)
        let extractedCode = decodedText;

        try {
          const url = new URL(decodedText);
          const pathParts = url.pathname.split('/').filter(Boolean);
          // Get the last part after /validate/
          const validateIndex = pathParts.indexOf('validate');
          if (validateIndex !== -1 && pathParts.length > validateIndex + 1) {
            extractedCode = pathParts[validateIndex + 1];
          }
        } catch {
          // Not a URL, use as-is (might be just the code)
        }

        // Clear scanner before navigating to release camera
        scanner.clear().then(() => {
          navigate(`/validate/${extractedCode}`);
        }).catch(() => {
          // Navigate anyway even if clear fails
          navigate(`/validate/${extractedCode}`);
        });
      };

      const onScanError = () => {
        // Ignore scan errors (continuous scanning)
      };

      scanner.render(onScanSuccess, onScanError);

      // Listen for permission denied errors from the scanner
      // The library fires a state change that we can catch
      const checkForPermissionError = () => {
        const errorElement = document.querySelector('#qr-reader__status_span');
        if (errorElement?.textContent?.toLowerCase().includes('permission')) {
          setScannerError('No se pudo acceder a la cámara. Por favor, permite el acceso.');
        }
      };

      // Check after a delay to allow scanner to initialize
      const permissionCheckTimeout = setTimeout(checkForPermissionError, 3000);

      return () => {
        clearTimeout(permissionCheckTimeout);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {
            // Ignore cleanup errors
          });
        }
      };
    } catch (error) {
      // Handle scanner initialization errors
      setScannerError('No se pudo inicializar el escáner. Por favor, verifica los permisos de la cámara.');
      return;
    }
  }, [navigate]);

  const handleRetry = () => {
    setScannerError(null);
    isInitializedRef.current = false;
    window.location.reload();
  };

  if (scannerError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Camera className="h-16 w-16 text-muted-foreground mb-4" aria-hidden="true" />
        <p className="text-lg text-center text-muted-foreground mb-6" role="alert">
          {scannerError}
        </p>
        <Button onClick={handleRetry}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4 text-center">
        <h1 className="text-xl font-semibold">Escanear entrada</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Apunta la cámara al código QR
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          id="qr-reader"
          className="w-full max-w-md"
          aria-label="Escáner de código QR"
        />
      </div>
    </div>
  );
}

// Result Mode Component
function ResultMode({ code }: { code: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasCheckedInRef = useRef(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [checkInError, setCheckInError] = useState(false);

  const { data: registration, isLoading } = useTicketLookup(code);
  const { checkIn, isChecking } = useCheckIn();

  const validation = validateTicket(registration ?? null);

  // Auto check-in with guards
  useEffect(() => {
    // Guard 1: Must be valid ticket
    // Guard 2: Must not have already triggered check-in
    // Guard 3: Must have user loaded
    // Guard 4: Must have registration data
    if (
      validation.isValid &&
      !hasCheckedInRef.current &&
      user?.id &&
      registration?.id
    ) {
      hasCheckedInRef.current = true;
      checkIn({ registrationId: registration.id })
        .then(() => {
          setCheckInSuccess(true);
        })
        .catch((error) => {
          // Surface error to user
          hasCheckedInRef.current = false;
          setCheckInError(true);
          toast.error('Error al registrar entrada. Por favor, inténtalo de nuevo.');
          console.error('Check-in error:', error);
        });
    }
  }, [validation.isValid, registration?.id, user?.id, checkIn]);

  // Reset state when code changes
  useEffect(() => {
    hasCheckedInRef.current = false;
    setCheckInSuccess(false);
    setCheckInError(false);
  }, [code]);

  const handleBackToScanner = () => {
    navigate('/validate');
  };

  // Loading state
  if (isLoading || isChecking) {
    return <LoadingPage message="Verificando entrada..." />;
  }

  // Success state - use checkInSuccess state to avoid race condition
  if (validation.isValid || checkInSuccess) {
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
              {registration?.first_name} {registration?.last_name}
            </p>
            <p className="text-sm text-green-600">
              {registration?.ticket_type?.name || 'General'}
            </p>
            <p className="text-sm text-green-600">{registration?.event?.name}</p>
            {registration?.team_name && (
              <p className="text-sm text-green-600 mt-1">
                Equipo: {registration.team_name}
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

  // Error state (including check-in network errors)
  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center px-4" role="alert" aria-live="assertive">
      <X className="h-24 w-24 text-amber-600 mb-4" aria-hidden="true" />
      <h1 className="text-4xl font-bold text-amber-700 mb-8">
        <span className="sr-only">Error: </span>
        {checkInError ? 'Error de conexión' : 'Código inválido'}
      </h1>

      {checkInError && (
        <p className="text-amber-600 mb-4 text-center">
          No se pudo registrar la entrada. Verifica tu conexión e inténtalo de nuevo.
        </p>
      )}

      <Button
        variant="outline"
        className="mt-8 border-amber-300 text-amber-700 hover:bg-amber-100"
        onClick={handleBackToScanner}
      >
        Volver al scanner
      </Button>
    </div>
  );
}
