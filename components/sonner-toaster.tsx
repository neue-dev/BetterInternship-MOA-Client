import React from "react";
import { Toaster, toast } from "sonner";
import { CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface ToastOptions {
  center?: boolean;
  fitContent?: boolean;
  compact?: boolean;
}

const createToastPreset = (
  icon: React.ReactNode | null,
  background: string,
  options: ToastOptions = {}
) => {
  const { center = true, fitContent = false, compact = false } = options;
  return {
    ...(icon ? { icon } : {}),
    style: {
      background,
      color: "#ffffff",
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...(fitContent ? { width: "fit-content" } : {}),
      ...(compact ? { padding: "6px 12px", fontSize: "12px" } : {}),
    },
  };
};

export const toastPresets = {
  success: createToastPreset(<CheckCircle className="h-5 w-5" />, "#059669"),
  destructive: createToastPreset(<AlertCircle className="h-5 w-5" />, "#dc2626"),
  alert: createToastPreset(<AlertTriangle className="h-5 w-5" />, "#d97706"),
  neutral: createToastPreset(null, "#475569", { compact: true, fitContent: true }),
};

export function createCustomToastPreset(
  background: string,
  icon: React.ReactNode,
  options?: ToastOptions
) {
  return createToastPreset(icon, background, options);
}

export function showCompactToast(message: string, icon: React.ReactNode) {
  toast.custom(
    (id) => (
      <div className="flex items-center gap-2 whitespace-nowrap rounded-[0.33em] bg-slate-600 px-3 py-1.5 text-xs text-white shadow-md">
        {icon}
        {message}
      </div>
    ),
    {
      duration: 2000,
      position: "top-center",
      unstyled: true,
      style: { width: "fit-content", minWidth: 0, left: 0, right: 0, margin: "0 auto" },
    }
  );
}

export function SonnerToaster() {
  return (
    <>
      <style>{`
        /* Toast container */
        [data-sonner-toast] {
          border-radius: 0.33em;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        /* Icon styling */
        [data-sonner-toast] svg {
          display: inline-block;
          margin-right: 8px;
        }
      `}</style>
      <Toaster position="top-center" />
    </>
  );
}
