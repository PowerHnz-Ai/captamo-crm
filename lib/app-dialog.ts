export type AppDialogVariant = "default" | "success" | "error" | "warning";

export interface AppAlertOptions {
  title?: string;
  variant?: AppDialogVariant;
  confirmLabel?: string;
}

export interface AppConfirmOptions extends AppAlertOptions {
  cancelLabel?: string;
  destructive?: boolean;
}

type DialogMode = "alert" | "confirm";

export interface AppDialogState {
  open: boolean;
  mode: DialogMode;
  title: string;
  message: string;
  variant: AppDialogVariant;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
}

type Resolver = (value: boolean) => void;

let resolver: Resolver | null = null;
let setDialogState: ((state: AppDialogState | null) => void) | null = null;

export function registerAppDialog(
  setter: (state: AppDialogState | null) => void
): () => void {
  setDialogState = setter;
  return () => {
    if (setDialogState === setter) setDialogState = null;
  };
}

function openDialog(
  mode: DialogMode,
  message: string,
  options: AppAlertOptions & AppConfirmOptions = {}
): Promise<boolean> {
  if (!setDialogState) {
    if (mode === "confirm") {
      return Promise.resolve(window.confirm(message));
    }
    window.alert(message);
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
    setDialogState!({
      open: true,
      mode,
      title: options.title || (mode === "confirm" ? "Confirmar" : "Aviso"),
      message,
      variant: options.variant || (mode === "confirm" && options.destructive ? "warning" : "default"),
      confirmLabel:
        options.confirmLabel || (mode === "confirm" ? (options.destructive ? "Excluir" : "Confirmar") : "OK"),
      cancelLabel: options.cancelLabel || "Cancelar",
      destructive: options.destructive || false,
    });
  });
}

export function resolveAppDialog(confirmed: boolean) {
  setDialogState?.(null);
  const r = resolver;
  resolver = null;
  r?.(confirmed);
}

export function appAlert(message: string, options?: AppAlertOptions): Promise<void> {
  return openDialog("alert", message, options).then(() => undefined);
}

export function appConfirm(message: string, options?: AppConfirmOptions): Promise<boolean> {
  return openDialog("confirm", message, options);
}
