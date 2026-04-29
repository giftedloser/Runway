import { Router } from "express";
import type Database from "better-sqlite3";

import {
  countDevicesForProvisioningTag,
  devicesForProvisioningTag,
  listProvisioningTags,
  payloadForGroups
} from "../db/queries/provisioning.js";
import { asArray } from "../engine/normalize.js";

export function provisioningRouter(db: Database.Database) {
  const router = Router();

  // GET /api/provisioning/tags — list Autopilot group tags currently seen on devices
  router.get("/tags", (_request, response) => {
    response.json(listProvisioningTags(db));
  });

  // GET /api/provisioning/tag-devices?groupTag=X — devices carrying a tag
  router.get("/tag-devices", (request, response) => {
    const groupTag = typeof request.query.groupTag === "string" ? request.query.groupTag.trim() : "";
    if (!groupTag) {
      response.status(400).json({ message: "groupTag query parameter is required." });
      return;
    }

    response.json(devicesForProvisioningTag(db, groupTag));
  });

  // GET /api/provisioning/discover?groupTag=X — auto-discover matching groups and profiles for a tag
  router.get("/discover", (request, response) => {
    const groupTag = typeof request.query.groupTag === "string" ? request.query.groupTag.trim() : "";
    if (!groupTag) {
      response.status(400).json({ message: "groupTag query parameter is required." });
      return;
    }

    // Find groups whose membership rule or name references this tag
    const matchingGroups = db
      .prepare(
        `SELECT id, display_name, membership_rule, membership_type
         FROM groups
         WHERE display_name LIKE ? OR membership_rule LIKE ?
         ORDER BY display_name`
      )
      .all(`%${groupTag}%`, `%${groupTag}%`) as Array<{
      id: string;
      display_name: string;
      membership_rule: string | null;
      membership_type: string;
    }>;

    // Find profiles assigned to those groups
    const groupIds = matchingGroups.map((g) => g.id);
    const matchingProfiles = groupIds.length > 0
      ? (db
          .prepare(
            `SELECT DISTINCT ap.id, ap.display_name, ap.deployment_mode, pa.group_id
             FROM autopilot_profile_assignments pa
             JOIN autopilot_profiles ap ON ap.id = pa.profile_id
             WHERE pa.group_id IN (${groupIds.map(() => "?").join(",")})
             ORDER BY ap.display_name`
          )
          .all(...groupIds) as Array<{
          id: string;
          display_name: string;
          deployment_mode: string | null;
          group_id: string;
        }>)
      : [];

    // Check tag_config for existing mapping
    const existingConfig = db
      .prepare(`SELECT * FROM tag_config WHERE group_tag = ?`)
      .get(groupTag) as {
      group_tag: string;
      expected_profile_names: string;
      expected_group_names: string;
      property_label: string;
    } | undefined;

    const deviceCount = countDevicesForProvisioningTag(db, groupTag);

    response.json({
      groupTag,
      deviceCount,
      matchingGroups: matchingGroups.map((g) => ({
        groupId: g.id,
        groupName: g.display_name,
        membershipRule: g.membership_rule,
        membershipType: g.membership_type
      })),
      matchingProfiles: matchingProfiles.map((p) => ({
        profileId: p.id,
        profileName: p.display_name,
        deploymentMode: p.deployment_mode,
        viaGroupId: p.group_id
      })),
      buildPayloadByGroupId: payloadForGroups(db, groupIds),
      existingConfig: existingConfig
        ? {
            groupTag: existingConfig.group_tag,
            propertyLabel: existingConfig.property_label,
            expectedProfileNames: asArray(existingConfig.expected_profile_names),
            expectedGroupNames: asArray(existingConfig.expected_group_names)
          }
        : null
    });
  });

  // POST /api/provisioning/validate — validate a complete provisioning chain
  router.post("/validate", (request, response) => {
    const { groupTag, groupId, profileId } = request.body ?? {};

    if (!groupTag && !groupId && !profileId) {
      response.status(400).json({ message: "At least one of groupTag, groupId, or profileId is required." });
      return;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!groupId) {
      warnings.push("No group selected — cannot validate group→profile assignment.");
    }
    if (!profileId) {
      warnings.push("No profile selected — cannot validate profile→group assignment.");
    }

    // Check group tag has devices
    if (groupTag) {
      const deviceCount = countDevicesForProvisioningTag(db, groupTag);
      if (deviceCount === 0) {
        warnings.push(`No devices currently have group tag "${groupTag}".`);
      }
    }

    // Check group exists
    if (groupId) {
      const group = db
        .prepare(`SELECT id, display_name, membership_rule, membership_type FROM groups WHERE id = ?`)
        .get(groupId) as { id: string; display_name: string; membership_rule: string | null; membership_type: string } | undefined;

      if (!group) {
        errors.push(`Group ${groupId} not found in synced data.`);
      } else {
        if (group.membership_type === "dynamic" && groupTag) {
          if (!group.membership_rule?.includes(groupTag)) {
            warnings.push(`Group "${group.display_name}" membership rule does not appear to reference tag "${groupTag}".`);
          }
        }
      }
    }

    // Check profile exists and is assigned to the group
    if (profileId) {
      const profile = db
        .prepare(`SELECT id, display_name, deployment_mode FROM autopilot_profiles WHERE id = ?`)
        .get(profileId) as { id: string; display_name: string; deployment_mode: string | null } | undefined;

      if (!profile) {
        errors.push(`Profile ${profileId} not found in synced data.`);
      } else if (groupId) {
        const assignment = db
          .prepare(`SELECT 1 FROM autopilot_profile_assignments WHERE profile_id = ? AND group_id = ?`)
          .get(profileId, groupId);
        if (!assignment) {
          errors.push(`Profile "${profile.display_name}" is not assigned to the specified group.`);
        }
      }
    }

    const valid = errors.length === 0;
    response.json({ valid, errors, warnings });
  });

  return router;
}
