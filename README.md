# APKDrop · Ship Android APK

**GitHub Release → APKDrop → clear Android download page with verifiable release facts.**

[Try APKDrop](https://apkdrop.rawinstinctai.de/) · [GitHub Marketplace](https://github.com/marketplace/actions/apkdrop-ship-android-apk) · [How it works](https://rawinstinctai.de/github-action)

![Action self-check](https://github.com/rawinstinctart/apkdrop-action/actions/workflows/ci.yml/badge.svg)

## Install in about 30 seconds

**1. Add one workflow.**

You can do this before APKDrop is configured. If the first run cannot find a published APKDrop app for the repository, the Action returns a **one-click setup URL** with that repository already filled in.

**2. Publish or connect the app once in APKDrop.**  
Open the setup link from the GitHub job summary, inspect the private draft, then publish the app when it is ready.

**3. Publish your next GitHub Release.**

Create `.github/workflows/apkdrop.yml`:

```yaml
name: APKDrop

on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write

jobs:
  apkdrop:
    runs-on: ubuntu-latest
    steps:
      - name: Sync APKDrop
        id: apkdrop
        uses: rawinstinctart/apkdrop-action@v1
```

APKDrop syncs the release, applies its normal APK selection and inspection pipeline, then keeps your existing public app page up to date.

No checkout step. No APKDrop API token. No long-lived secret. The first-run setup link is derived only from GitHub's signed repository identity.

## Why this Action exists

A GitHub Release is great for developers. APKDrop adds the user-facing layer around the APK:

- **Smart APK Match** — prefers plausible release APKs and stops instead of guessing when variants are ambiguous.
- **SHA-256** — hashes the mirrored APK and compares GitHub's digest when available.
- **Android facts** — extracts package, version, SDK requirements, permissions and native ABIs from the APK.
- **Signer checks** — tracks signer continuity instead of turning it into a vague security score.
- **Release Receipt** — exposes a deterministic record of source, APK identity and verified facts.
- **Stable app URL** — users keep one clean download page while releases change underneath it.

These checks document provenance, integrity and Android package facts. They are **not** a malware certification.

## Secretless by design

APKDrop uses **GitHub Actions OIDC** instead of an APKDrop API key.

The workflow requests a short-lived GitHub identity token with audience `apkdrop.rawinstinctai.de`. APKDrop verifies GitHub's signature, issuer, audience, expiry, repository name and immutable GitHub repository ID. Pull-request contexts are rejected server-side.

That means the Action does **not** need:

- an `APKDROP_TOKEN`
- a copied API key
- a repository secret containing APKDrop credentials

The Action can only synchronize an already-published APKDrop app connected to the same GitHub repository.

## Common workflows

### A. Recommended: sync whenever a GitHub Release is published

Use the 30-second example above. This is the simplest setup and requires only:

```yaml
permissions:
  contents: read
  id-token: write
```

Full file: [examples/release-published.yml](examples/release-published.yml)

### B. Build, create a GitHub Release, then sync APKDrop

If your workflow already builds an APK and creates the GitHub Release, run APKDrop **after** the release step and pass the tag explicitly.

```yaml
- name: Sync APKDrop
  id: apkdrop
  uses: rawinstinctart/apkdrop-action@v1
  with:
    release-tag: ${{ github.ref_name }}
```

A complete Gradle example is in [examples/build-release-and-sync.yml](examples/build-release-and-sync.yml). Adjust the APK path to your project.

## Outputs

The Action waits for APKDrop by default and exposes useful release data:

| Output | What you get |
| --- | --- |
| `showcase-url` | Public APKDrop app page |
| `download-url` | Immutable APK download URL |
| `version` | Synced Android version |
| `sha256` | APK SHA-256 |
| `receipt-url` | Release Receipt |
| `setup-url` | One-click first-run setup URL when the app is not connected yet |
| `status` | `queued`, `ready`, `setup-required` or `error` |

Example:

```yaml
- name: Show APKDrop result
  run: |
    echo "Page: ${{ steps.apkdrop.outputs.showcase-url }}"
    echo "APK:  ${{ steps.apkdrop.outputs.download-url }}"
    echo "SHA:  ${{ steps.apkdrop.outputs.sha256 }}"
```

GitHub's job summary also gets a compact APKDrop result with version, page, APK, receipt and SHA-256.

## One repository, multiple APKDrop apps

If the same GitHub repository feeds more than one published APKDrop app, choose the public slug explicitly:

```yaml
- uses: rawinstinctart/apkdrop-action@v1
  with:
    app: my-foss-build
```

Without `app`, APKDrop fails closed instead of choosing between multiple apps.

## Inputs

| Input | Required | Default | Purpose |
| --- | --- | --- | --- |
| `app` | No | — | APKDrop slug when one repository has multiple apps |
| `wait` | No | `true` | Wait for APKDrop inspection |
| `timeout-seconds` | No | `180` | Maximum wait, capped at 900 seconds |
| `release-tag` | No | auto | Expected GitHub release tag |
| `endpoint` | No | APKDrop Worker | Transport override for advanced use |

## Fail-closed behavior

The Action deliberately stops when APKDrop needs a human decision, for example:

- two APK variants are equally plausible
- app identity changes
- inspection fails
- a configured filename filter no longer matches
- the APK exceeds the supported size limit

Your previously published APK stays available; the Action does not silently replace it with an uncertain candidate.

## First run before APKDrop is configured

You may install the Action first. If no published APKDrop app exists for the signed GitHub repository, the Action fails safely with `status=setup-required`, exposes `setup-url`, and writes a direct setup link into the GitHub job summary.

That link opens APKDrop with the current GitHub repository already filled in and starts the normal private preview flow. Nothing is published automatically. You inspect the result and explicitly publish once. Then **re-run the failed GitHub job once** to sync the release that triggered setup. After that, the same Action handles release-to-release synchronization automatically.

**[Try APKDrop →](https://apkdrop.rawinstinctai.de/)**  
**[See the 30-second setup page →](https://rawinstinctai.de/github-action)**

## License

This public Action repository is licensed under MIT. The separate APKDrop product and its private source code are not made open source by this license.

## Security

Please report security issues privately to [kontakt@rawinstinctai.de](mailto:kontakt@rawinstinctai.de). Never post tokens or credentials in a public issue.
