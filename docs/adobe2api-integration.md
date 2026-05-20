# Adobe2API Integration Notes

## Resource Ownership

Jike embeds Adobe2API from the project-local directory:

- Development: `resources/adobe2api-master`
- Packaged app: `process.resourcesPath/adobe2api-master`

Do not depend on `E:\code\ref\adobe2api-master` at runtime. That directory may be deleted after the project resource copy is present.

## Repository Storage

The Adobe2API source files under `resources/adobe2api-master` are part of the project and should be kept in source control. Runtime/private files must stay out of source control:

- `resources/adobe2api-master/data/**`
- `resources/adobe2api-master/**/__pycache__/**`
- `resources/adobe2api-master/config/config.json`
- `resources/adobe2api-master/config/tokens.json`
- `resources/adobe2api-master/config/refresh_profile.json`
- `resources/adobe2api-master/tokens.json`

These are ignored by `resources/adobe2api-master/.gitignore` and excluded from Electron packaging.

## Packaging

`electron-builder.yml` copies Adobe2API with `extraResources` to `adobe2api-master`, which matches `src/main/ipc/adobe2api/service.ts`.

The package filters also exclude runtime logs, tokens, refresh profiles, local config and Python cache files. Keep those filters in sync with `resources/adobe2api-master/.gitignore`.

Jike can also package a project-local Python runtime from `resources/python`. The main process prefers that runtime and falls back to system `python` only when the embedded runtime is absent.

`resources/python` is intentionally ignored by Git because it is a generated binary environment, but it is copied into the installer by `electron-builder.yml`.

## Maintenance Commands

Check that project-local resources are complete:

```bash
npm run check:adobe2api
```

Apply Electron embedding patches to the project-local resource copy:

```bash
npm run prepare:adobe2api
```

Create or refresh the embedded Python environment:

```bash
npm run prepare:adobe2api-python
```

Check the embedded Python environment:

```bash
npm run check:adobe2api-python
```

Sync from an external Adobe2API source only when explicitly needed:

```bash
ADOBE2API_SOURCE_DIR=E:\path\to\adobe2api-master npm run prepare:adobe2api
```

The prepare script intentionally does not default to `E:\code\ref\adobe2api-master`.

## Current Video Model Policy

The New Video node currently hides these Adobe video model entries:

- `adobe-veo31`
- `adobe-veo31-fast`

Historical nodes using those ids are normalized to `adobe-sora2-pro` so the model dropdown does not render an empty value.

The lower-level Adobe2API request/types for Veo3.1 are still present. This keeps direct API compatibility and makes it possible to re-enable the UI later without reconstructing the integration.
