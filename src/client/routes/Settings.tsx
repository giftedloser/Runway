import { useState } from "react";
import { CheckCircle, Plus, Trash2, XCircle } from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { useSettings, useTagConfigMutations } from "../hooks/useSettings.js";

export function SettingsPage() {
  const settings = useSettings();
  const mutations = useTagConfigMutations();
  const [form, setForm] = useState({
    groupTag: "",
    propertyLabel: "",
    expectedProfileNames: "",
    expectedGroupNames: ""
  });

  if (settings.isLoading || !settings.data) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[var(--pc-text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pc-accent)] border-t-transparent" />
        Loading settings&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Configuration"
        description="Microsoft Graph connection status and property-tag mappings for profile and group expectation checks."
      />

      {/* Graph readiness */}
      <Card className="p-5">
        <div className="flex items-center gap-3">
          {settings.data.graph.configured ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]">
              <CheckCircle className="h-4 w-4 text-[var(--pc-healthy)]" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-critical-muted)]">
              <XCircle className="h-4 w-4 text-[var(--pc-critical)]" />
            </div>
          )}
          <div>
            <div className="text-[13px] font-semibold text-white">Graph Connection</div>
            <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
              {settings.data.graph.configured
                ? "Credentials detected and ready."
                : `Missing: ${settings.data.graph.missing.join(", ")}`}
            </div>
          </div>
        </div>
      </Card>

      {/* Add tag mapping */}
      <Card className="p-5">
        <div className="mb-4 text-[13px] font-semibold text-white">Add Tag Mapping</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Group tag"
            value={form.groupTag}
            onChange={(event) => setForm((previous) => ({ ...previous, groupTag: event.target.value }))}
          />
          <Input
            placeholder="Property label"
            value={form.propertyLabel}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, propertyLabel: event.target.value }))
            }
          />
          <Input
            placeholder="Expected profiles (comma-separated)"
            value={form.expectedProfileNames}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, expectedProfileNames: event.target.value }))
            }
          />
          <Input
            placeholder="Expected groups (comma-separated)"
            value={form.expectedGroupNames}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, expectedGroupNames: event.target.value }))
            }
          />
        </div>
        <div className="mt-4">
          <Button
            disabled={!form.groupTag || !form.propertyLabel}
            onClick={() =>
              mutations.create.mutate(
                {
                  groupTag: form.groupTag,
                  propertyLabel: form.propertyLabel,
                  expectedProfileNames: form.expectedProfileNames
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                  expectedGroupNames: form.expectedGroupNames
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                },
                {
                  onSuccess: () =>
                    setForm({ groupTag: "", propertyLabel: "", expectedProfileNames: "", expectedGroupNames: "" })
                }
              )
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Save Mapping
          </Button>
        </div>
      </Card>

      {/* Existing mappings */}
      {settings.data.tagConfig.length > 0 && (
        <div>
          <div className="mb-3 text-[13px] font-semibold text-white">Existing Mappings</div>
          <div className="grid gap-3 xl:grid-cols-2">
            {settings.data.tagConfig.map((row) => (
              <Card key={row.groupTag} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-white">{row.groupTag}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
                      {row.propertyLabel}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="h-8 px-2.5"
                    onClick={() => mutations.remove.mutate(row.groupTag)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3 space-y-1.5 text-[12px]">
                  <div className="text-[var(--pc-text-secondary)]">
                    <span className="text-[var(--pc-text-muted)]">Profiles:</span>{" "}
                    {row.expectedProfileNames.join(", ") || "\u2014"}
                  </div>
                  <div className="text-[var(--pc-text-secondary)]">
                    <span className="text-[var(--pc-text-muted)]">Groups:</span>{" "}
                    {row.expectedGroupNames.join(", ") || "\u2014"}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
