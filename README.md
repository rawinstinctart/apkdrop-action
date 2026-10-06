# APKDrop GitHub Action

GitHub Release → APKDrop → verified Android download page.

Sync published Android releases to APKDrop using **GitHub OIDC**. No APKDrop API token or other APKDrop secret is needed. The existing published APKDrop app must be connected to the same GitHub repository that runs this Action.

APKDrop continues to perform Smart APK Match, SHA-256 calculation, Android-fact extraction, signer checks, and Release Receipt generation. These checks are not a malware certification. Pull-request contexts are rejected server-side and are not accepted as release automation.

## Usage

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

No checkout step is required. If one GitHub repository is connected to multiple published APKDrop apps, select the public app slug:

```yaml
      - name: Sync APKDrop
        id: apkdrop
        uses: rawinstinctart/apkdrop-action@v1
        with:
          app: my-app
```

The Action requests a short-lived GitHub OIDC token with audience `apkdrop.rawinstinctai.de` and sends it to `https://apkdrop.rawinstinctart.workers.dev`. It does not use an APKDrop API secret.

## Outputs

Use outputs through `steps.<id>.outputs.<name>`:

- `showcase-url` — public APKDrop app page
- `download-url` — download URL for the synced release
- `version` — Android release version
- `sha256` — APK SHA-256
- `receipt-url` — APKDrop Release Receipt
- `status` — final sync status

## Links

- Product: [apkdrop.rawinstinctai.de](https://apkdrop.rawinstinctai.de)
- RawInstinctAI: [rawinstinctai.de](https://rawinstinctai.de)
- Docs: [rawinstinctai.de/guides](https://rawinstinctai.de/guides)

## License

This repository's Action files are licensed under MIT. This does **not** make the separate APKDrop product or its private source code open source.
