import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { ProfileCard } from "../components/profiles/ProfileCard.js";
import { ProfileHealthBreakdown } from "../components/profiles/ProfileHealthBreakdown.js";
import { useProfiles } from "../hooks/useProfiles.js";

export function ProfileAuditPage() {
  const profiles = useProfiles();

  if (profiles.isLoading) return <LoadingState label="Loading profiles…" />;
  if (profiles.isError || !profiles.data) {
    return (
      <ErrorState
        title="Could not load profiles"
        error={profiles.error}
        onRetry={() => profiles.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inspect"
        title="Deployment Profiles"
        description="Audit Intune deployment profiles as shared failure domains. Identify targeting gaps, missing assignments, hybrid-join risk, and tag mismatches across the estate."
        actions={<SourceBadge source="intune" />}
      />
      {profiles.data.length === 0 ? (
        <div className="text-[13px] text-[var(--pc-text-muted)]">
          No profiles found. Run a sync to pull profile data from Graph.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {profiles.data.map((profile) => (
            <div key={profile.profileId} className="space-y-3">
              <ProfileCard profile={profile} />
              <ProfileHealthBreakdown profile={profile} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
