Run this when you add or remove fonts under `font/` to regenerate `font/manifest.json`:

```bash
npm run update-font-manifest
```

This will scan the `font/` directory recursively and write all `.ttf` and `.otf` paths (relative to repo root) into `font/manifest.json`.
