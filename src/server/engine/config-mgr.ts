/**
 * Helpers for interpreting Intune's `managedDevice.managementAgent` field.
 *
 * The Graph enum includes several agent combinations; any value containing
 * the substring `configurationManager` means the SCCM / ConfigMgr client
 * is installed on the device (standalone MECM, co-managed with Intune,
 * or tenant-attached). We match on the substring rather than an exact
 * allow-list so new combined values (e.g. future `configurationManager*`
 * bit-combinations Microsoft adds) continue to be recognised without a
 * code change.
 *
 * Reference: https://learn.microsoft.com/graph/api/resources/intune-devices-managementagenttype
 */

export function hasConfigMgrClient(managementAgent: string | null | undefined): boolean {
  if (!managementAgent) return false;
  return managementAgent.toLowerCase().includes("configurationmanager");
}
