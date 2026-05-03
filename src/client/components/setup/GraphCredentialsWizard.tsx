import { useState } from "react";
import { CheckCircle2, FolderOpen, KeyRound, RefreshCcw, ShieldAlert } from "lucide-react";

import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { useAuthStatus } from "../../hooks/useAuth.js";
import { isTauriRuntime, revealPathInExplorer } from "../../lib/desktop.js";
import { useToast } from "../shared/toast.js";
import {
  useGraphEnvInfo,
  useSaveGraphCredentials,
  type GraphCredentialsInput
} from "../../hooks/useSettings.js";

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface FormState extends GraphCredentialsInput {
  redirectUri: string;
}

const EMPTY_FORM: FormState = {
  tenantId: "",
  clientId: "",
  clientSecret: "",
  redirectUri: ""
};

interface FieldErrors {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!GUID_RE.test(form.tenantId.trim())) {
    errors.tenantId = "Tenant ID must be a GUID (e.g. 11111111-2222-3333-4444-555555555555).";
  }
  if (!GUID_RE.test(form.clientId.trim())) {
    errors.clientId = "Client ID must be a GUID.";
  }
  if (form.clientSecret.trim().length < 8) {
    errors.clientSecret = "Paste the secret value (not the secret ID).";
  }
  if (form.redirectUri.trim() !== "") {
    try {
      new URL(form.redirectUri);
    } catch {
      errors.redirectUri = "Redirect URI must be a full URL if provided.";
    }
  }
  return errors;
}

interface Props {
  /** Called when the operator dismisses the post-save restart banner. */
  onDismissRestart?: () => void;
}

export function GraphCredentialsWizard({ onDismissRestart }: Props) {
  const envInfo = useGraphEnvInfo();
  const auth = useAuthStatus();
  const save = useSaveGraphCredentials();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    tenantId: false,
    clientId: false,
    clientSecret: false,
    redirectUri: false
  });
  const [savedTo, setSavedTo] = useState<string | null>(null);

  async function handleRevealEnv(envPath: string) {
    if (isTauriRuntime()) {
      const ok = await revealPathInExplorer(envPath);
      if (!ok) {
        toast.push({
          variant: "warning",
          title: "Could not open folder",
          description: "Open this path manually in File Explorer."
        });
      }
      return;
    }
    // Browser fallback: copy the path so the operator can paste it.
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(envPath).then(
        () =>
          toast.push({
            variant: "info",
            title: "Path copied",
            description: "The .env path is on your clipboard."
          }),
        () =>
          toast.push({
            variant: "warning",
            title: "Could not copy path",
            description: envPath
          })
      );
    }
  }

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;
  const isConfigured = envInfo.data?.configured ?? false;
  const isAuthed = auth.data?.authenticated === true;
  // Rotating existing credentials requires an admin session (the server
  // enforces this too). First-run setup is open because nobody can have
  // signed in yet without Graph being wired up.
  const isLocked = isConfigured && !isAuthed;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit() {
    setTouched({ tenantId: true, clientId: true, clientSecret: true, redirectUri: true });
    if (!isValid) return;

    const payload: GraphCredentialsInput = {
      tenantId: form.tenantId.trim(),
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret,
      ...(form.redirectUri.trim() ? { redirectUri: form.redirectUri.trim() } : {})
    };
    save.mutate(payload, {
      onSuccess: (result) => {
        setSavedTo(result.envPath);
        setForm(EMPTY_FORM);
        setTouched({
          tenantId: false,
          clientId: false,
          clientSecret: false,
          redirectUri: false
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Status / target file row */}
      <div className="flex items-start gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-accent)]" />
        <div className="min-w-0 flex-1 text-[12px] text-[var(--pc-text-secondary)]">
          {envInfo.isLoading
            ? "Loading credential status…"
            : isLocked
              ? "Server-side credentials are present. Sign in as an admin to rotate them — the wizard requires a delegated session once Graph is configured."
              : isConfigured
                ? "Signed in. Paste new values below to rotate the tenant ID, client ID, and/or secret. A restart is required after save."
                : envInfo.data
                  ? `Missing: ${envInfo.data.missing.join(", ") || "—"}. Saving below will write to the server's .env and prompt for a restart.`
                  : "Credential status unavailable."}
        </div>
      </div>

      {/* Active .env path — promoted to its own row so an operator who
          edits .env directly can never miss WHICH file Runway reads.
          Editing a stranger .env (e.g. the dev project root) was a real
          confusion mode before this row existed. */}
      {envInfo.data?.envPath && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
              Runway is reading from
            </div>
            <div className="mt-0.5 truncate font-mono text-[12px] text-[var(--pc-text)]" title={envInfo.data.envPath}>
              {envInfo.data.envPath}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => handleRevealEnv(envInfo.data!.envPath)}
            title={isTauriRuntime() ? "Reveal in File Explorer" : "Copy path to clipboard"}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {isTauriRuntime() ? "Open folder" : "Copy path"}
          </Button>
        </div>
      )}

      {/* Restart banner — only after a successful save */}
      {savedTo && (
        <div className="flex items-start gap-3 rounded-lg border border-[var(--pc-warning)]/40 bg-[var(--pc-warning-muted)] p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-warning)]" />
          <div className="min-w-0 flex-1 text-[12px] text-[var(--pc-text)]">
            <div className="font-semibold">Credentials saved — restart Runway to apply</div>
            <div className="mt-0.5 text-[var(--pc-text-secondary)]">
              The new tenant ID, client ID, and secret were written to{" "}
              <span className="font-mono text-[11px]">{savedTo}</span>. The server reads these only at startup, so close and reopen Runway (or restart the sidecar service) before signing in.
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setSavedTo(null);
              onDismissRestart?.();
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Form */}
      <fieldset disabled={isLocked || save.isPending} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Tenant ID
          </label>
          <Input
            placeholder="11111111-2222-3333-4444-555555555555"
            value={form.tenantId}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => update("tenantId", event.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, tenantId: true }))}
            aria-invalid={touched.tenantId && Boolean(errors.tenantId)}
            className="mt-1 w-full font-mono text-[12px]"
          />
          {touched.tenantId && errors.tenantId && (
            <p className="mt-1 text-[11px] text-[var(--pc-critical)]">{errors.tenantId}</p>
          )}
        </div>
        <div className="sm:col-span-1">
          <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Client ID (App registration)
          </label>
          <Input
            placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
            value={form.clientId}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => update("clientId", event.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, clientId: true }))}
            aria-invalid={touched.clientId && Boolean(errors.clientId)}
            className="mt-1 w-full font-mono text-[12px]"
          />
          {touched.clientId && errors.clientId && (
            <p className="mt-1 text-[11px] text-[var(--pc-critical)]">{errors.clientId}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Client secret (value, not ID)
          </label>
          <Input
            type="password"
            placeholder="•••••••• paste the secret VALUE shown when you created it"
            value={form.clientSecret}
            autoComplete="new-password"
            spellCheck={false}
            onChange={(event) => update("clientSecret", event.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, clientSecret: true }))}
            aria-invalid={touched.clientSecret && Boolean(errors.clientSecret)}
            className="mt-1 w-full font-mono text-[12px]"
          />
          {touched.clientSecret && errors.clientSecret && (
            <p className="mt-1 text-[11px] text-[var(--pc-critical)]">{errors.clientSecret}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Redirect URI <span className="text-[var(--pc-text-muted)]">(optional — defaults to http://localhost:3001/api/auth/callback)</span>
          </label>
          <Input
            placeholder="http://localhost:3001/api/auth/callback"
            value={form.redirectUri}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => update("redirectUri", event.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, redirectUri: true }))}
            aria-invalid={touched.redirectUri && Boolean(errors.redirectUri)}
            className="mt-1 w-full font-mono text-[12px]"
          />
          {touched.redirectUri && errors.redirectUri && (
            <p className="mt-1 text-[11px] text-[var(--pc-critical)]">{errors.redirectUri}</p>
          )}
        </div>
      </fieldset>

      {/* Errors from the server */}
      {save.isError && (
        <div className="rounded-lg border border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)] px-3 py-2 text-[12px] text-[var(--pc-critical)]">
          {save.error instanceof Error ? save.error.message : "Failed to save credentials."}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={isLocked || !isValid || save.isPending}
        >
          {save.isPending ? (
            <>
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isConfigured ? "Rotate credentials" : "Save credentials"}
            </>
          )}
        </Button>
        {isLocked && (
          <span className="text-[11px] text-[var(--pc-text-muted)]">
            Sign in to rotate existing credentials.
          </span>
        )}
      </div>
    </div>
  );
}
