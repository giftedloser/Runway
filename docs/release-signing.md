# Release Signing & Auto-Update

Runway ships as a Tauri-bundled MSI. To distribute updates safely two
signing flows must be configured. This file documents the manual
one-time setup; the rest of the pipeline (CI release, `latest.json`
publication) is just GitHub Releases plumbing.

## 1. Tauri update signing key (mandatory before first release)

The Tauri updater verifies every downloaded artifact against an
embedded ed25519 public key. Without it, every install is on its own
trust path.

```bash
# Generate the keypair. Use a strong passphrase — losing it means
# regenerating and shipping a new release that users have to install
# manually.
npx @tauri-apps/cli signer generate -w ~/.runway/runway-update.key

# Capture the printed PUBLIC key and paste it into:
#   src-tauri/tauri.conf.json → plugins.updater.pubkey
#
# The PRIVATE key (`runway-update.key`) and its passphrase are the
# update signing material. Keep them outside the repo. CI loads them
# via these env vars at release time:
#
#   TAURI_SIGNING_PRIVATE_KEY        (file contents, not path)
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

When `tauri build` runs with those env vars present, the updater
sidecar files (`*.msi.zip` + `*.msi.zip.sig` on Windows) are produced
alongside the regular installer. Upload all three to the GitHub
Release and publish a `latest.json` manifest that points at them.

## 2. Authenticode signing (recommended for Windows)

Without Authenticode, every install triggers SmartScreen
"unrecognized publisher" warnings. Two paths:

- **EV cert** — best UX, no SmartScreen reputation warm-up. Required
  for enterprise distribution. Cost: ~$300/year, vendor-bound to a
  hardware token.
- **Standard code-signing cert** — works, but SmartScreen still warns
  for ~30 days while Microsoft builds reputation.

Once you have a cert, set `bundle.windows.signCommand` in
`tauri.conf.json` to the `signtool` invocation, e.g.:

```json
"signCommand": "signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a %1"
```

Or use `azuresigntool` if you stored the cert in Azure Key Vault.

## 3. `latest.json` shape

The updater polls the URL listed in
`tauri.conf.json → plugins.updater.endpoints` and expects:

```json
{
  "version": "0.2.0",
  "notes": "Release notes shown in the in-app updater dialog.",
  "pub_date": "2026-04-26T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contents of *.msi.zip.sig>",
      "url": "https://github.com/giftedloser/PilotCheck/releases/download/v0.2.0/Runway_0.2.0_x64_en-US.msi.zip"
    }
  }
}
```

Build this file in CI from the artifacts and upload it as the
release's `latest.json` asset.

## 4. CI hand-off (todo)

A GitHub Actions workflow at `.github/workflows/release.yml` (not yet
authored) should:

1. Build `npm run build:desktop-runtime`.
2. Run `tauri build` with the two `TAURI_SIGNING_*` secrets exported.
3. Upload the MSI, `*.msi.zip`, `*.msi.zip.sig`, and a generated
   `latest.json` to the release named after the tag.

Until that workflow exists, releases are produced locally with the
same env vars set in the developer's shell.
