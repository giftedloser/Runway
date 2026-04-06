import { PageHeader } from "../components/layout/PageHeader.js";
import { ProfileCard } from "../components/profiles/ProfileCard.js";
import { ProfileHealthBreakdown } from "../components/profiles/ProfileHealthBreakdown.js";
import { useProfiles } from "../hooks/useProfiles.js";

export function ProfileAuditPage() {
  const profiles = useProfiles();

  if (profiles.isLoading || !profiles.data) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[var(--pc-text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pc-accent)] border-t-transparent" />
        Loading profiles&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Profiles"
        title="Profile Audit"
        description="Review deployment profiles as shared failure domains. Identify targeting gaps, missing assignments, and tag mismatches."
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
