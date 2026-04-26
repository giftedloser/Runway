import { useState } from "react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { ProfileCard } from "../components/profiles/ProfileCard.js";
import { ProfileDrawer } from "../components/profiles/ProfileDrawer.js";
import { ProfileHealthBreakdown } from "../components/profiles/ProfileHealthBreakdown.js";
import { Card } from "../components/ui/card.js";
import { useProfiles } from "../hooks/useProfiles.js";

export function ProfileAuditPage() {
  const profiles = useProfiles();
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);

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
        description="Find profile-level assignment and targeting failures."
        actions={<SourceBadge source="intune" />}
      />
      {profiles.data.length === 0 ? (
        <div className="text-[13px] text-[var(--pc-text-muted)]">
          No profiles found. Run a sync to pull profile data from Graph.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {profiles.data.map((profile) => (
            <Card key={profile.profileId} className="divide-y divide-[var(--pc-border)]">
              <div className="p-4">
                <ProfileCard
                  profile={profile}
                  onInspect={() => setOpenProfileId(profile.profileId)}
                />
              </div>
              <div className="p-4">
                <ProfileHealthBreakdown profile={profile} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProfileDrawer
        profileId={openProfileId}
        onClose={() => setOpenProfileId(null)}
      />
    </div>
  );
}
