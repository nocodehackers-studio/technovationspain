import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthError } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface OtpOptions {
  emailRedirectTo?: string;
  data?: Record<string, string>;
}

export interface UseOtpFlowOptions {
  otpOptions?: OtpOptions;
  beforeSend?: (email: string) => Promise<boolean>;
  onVerified?: (session: { user: { id: string } }) => Promise<void> | void;
}

export interface UseOtpFlowReturn {
  email: string;
  setEmail: (email: string) => void;
  emailSent: boolean;
  otpCode: string;
  setOtpCode: (code: string) => void;
  loading: boolean;
  verifyingOtp: boolean;
  cooldownRemaining: number;
  sendOtp: (e?: React.FormEvent) => Promise<void>;
  resendOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  resetFlow: () => void;
}

function isRateLimitError(error: AuthError | Error): boolean {
  if ('status' in error && (error as AuthError).status === 429) return true;
  const msg = error.message?.toLowerCase() || '';
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('email rate limit');
}

function startCooldown(
  seconds: number,
  setCooldown: React.Dispatch<React.SetStateAction<number>>,
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  if (intervalRef.current) clearInterval(intervalRef.current);
  setCooldown(seconds);
  intervalRef.current = setInterval(() => {
    setCooldown((prev) => {
      if (prev <= 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
}

export function useOtpFlow(options: UseOtpFlowOptions = {}): UseOtpFlowReturn {
  const { otpOptions, beforeSend, onVerified } = options;

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const sendingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownEmailRef = useRef('');

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const sendOtp = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email) {
      toast.error('Por favor, introduce tu email');
      return;
    }

    // If cooldown is still active for the same email (e.g. user went back and
    // resubmitted), skip sending and just restore the verification view.
    if (cooldownRemaining > 0 && email === cooldownEmailRef.current) {
      setEmailSent(true);
      return;
    }

    if (sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);

    try {
      if (beforeSend) {
        const shouldContinue = await beforeSend(email);
        if (!shouldContinue) {
          setLoading(false);
          sendingRef.current = false;
          return;
        }
      }

      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: otpOptions?.emailRedirectTo
            ? otpOptions.emailRedirectTo
            : `${baseUrl}/auth/callback`,
          ...(otpOptions?.data ? { data: otpOptions.data } : {}),
        },
      });

      if (error) {
        if (isRateLimitError(error)) {
          const cooldownSeconds = 120;
          toast.error(`Por favor, espera ${cooldownSeconds}s antes de intentarlo de nuevo.`);
          cooldownEmailRef.current = email;
          startCooldown(cooldownSeconds, setCooldownRemaining, intervalRef);
          setEmailSent(true);
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        setEmailSent(true);
        toast.success('¡Enlace enviado! Revisa tu correo electrónico');
        cooldownEmailRef.current = email;
        startCooldown(60, setCooldownRemaining, intervalRef);
      }
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }, [email, cooldownRemaining, beforeSend, otpOptions]);

  const resendOtp = useCallback(async () => {
    if (cooldownRemaining > 0 || sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);

    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocalhost ? window.location.origin : 'https://technovationspain.lovable.app';

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: otpOptions?.emailRedirectTo
            ? otpOptions.emailRedirectTo
            : `${baseUrl}/auth/callback`,
          ...(otpOptions?.data ? { data: otpOptions.data } : {}),
        },
      });

      if (error) {
        if (isRateLimitError(error)) {
          const cooldownSeconds = 120;
          toast.error(`Por favor, espera ${cooldownSeconds}s antes de intentarlo de nuevo.`);
          cooldownEmailRef.current = email;
          startCooldown(cooldownSeconds, setCooldownRemaining, intervalRef);
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        setOtpCode('');
        toast.success('¡Código reenviado! Revisa tu correo electrónico');
        cooldownEmailRef.current = email;
        startCooldown(60, setCooldownRemaining, intervalRef);
      }
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }, [email, cooldownRemaining, otpOptions]);

  const verifyOtp = useCallback(async () => {
    if (otpCode.length !== 8) {
      toast.error('Introduce el código de 8 dígitos completo');
      return;
    }
    if (verifyingOtp) return;
    setVerifyingOtp(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (error) throw error;

      if (data.session) {
        toast.success('¡Verificación exitosa!');
        if (onVerified) {
          await onVerified(data.session);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Código inválido o expirado');
    } finally {
      setVerifyingOtp(false);
    }
  }, [email, otpCode, verifyingOtp, onVerified]);

  const resetFlow = useCallback(() => {
    setEmailSent(false);
    setOtpCode('');
    // Intentionally keep cooldownRemaining and timer running so that
    // re-submitting the same email restores the verification view
    // without firing another OTP request.
  }, []);

  return {
    email,
    setEmail,
    emailSent,
    otpCode,
    setOtpCode,
    loading,
    verifyingOtp,
    cooldownRemaining,
    sendOtp,
    resendOtp,
    verifyOtp,
    resetFlow,
  };
}
