# AmaliCode

AmaliCode is unmodified [OpenCode](https://github.com/anomalyco/opencode) (MIT), locked to the AmaliAI gateway and branded through OpenCode's public plugin API. This repo holds only the plugin, launcher and installer; the OpenCode binary is the official upstream release, so taking an upstream release is a version bump, not a merge.

## Pieces

| Path | What it does |
|---|---|
| `install.sh` | Downloads the pinned OpenCode release from upstream GitHub, installs the plugin and launcher into `~/.amalicode`, adds `amalicode` to PATH |
| `script/release.sh` | Builds the release assets: stamped `install.sh`, `amalicode-bundle.tar.gz`, `SHA256SUMS` |
| `launcher/amalicode` | Runs the pinned binary with the plugin injected via `OPENCODE_CONFIG_CONTENT` / `OPENCODE_TUI_CONFIG`; prompts for a key on first launch (offline check only) |
| `plugin/src/server.ts` | `config` hook: registers the `amaliai` provider, fills models from the gateway, forces `enabled_providers: ["amaliai"]` and `autoupdate: false`. `auth` hook: API-key login |
| `plugin/src/gateway.ts` | `/v1/models` + `/v1/model/info`: per-key model scoping, limits, per-million pricing, mode filtering |
| `plugin/src/tui.tsx` | `home_logo` slot (wordmark), brand theme, terminal title |

## Install

```bash
curl -fsSL https://github.com/Clifford-Kwakye/amalicode/releases/latest/download/install.sh | bash
```

Add `-s -- --channel dev` after `bash` for the dev gateway. From a checkout, `./install.sh --channel dev` installs the files beside it instead. Everything lands in `~/.amalicode` (`AMALICODE_HOME` overrides). The key is stored by OpenCode in `~/.local/share/opencode/auth.json` on first launch, or read from `AMALICODE_API_KEY`. `amalicode upgrade` reinstalls from the latest release, keeping the channel.

## Releasing

Push a tag: `git tag v0.1.0 && git push origin v0.1.0`. `.github/workflows/release.yml` tests the plugin, runs `script/release.sh` to stamp `install.sh` with that release's URLs and pack `amalicode-bundle.tar.gz`, smoke-tests the installer, and publishes both with `SHA256SUMS`.

To take a new upstream OpenCode release: install it with `./install.sh --version <new>`, run the evaluation set, then change `OPENCODE_VERSION` in `install.sh` and tag a release. The contract with upstream is the plugin API (`@opencode-ai/plugin`), the `config`/`auth` hooks, the `home_logo` slot, and the `OPENCODE_CONFIG_CONTENT` / `OPENCODE_TUI_CONFIG` variables.

## Develop

```bash
cd plugin
bun install
bun test
bunx tsc -p .
```

Try the plugin against upstream source without installing: in a clone of [anomalyco/opencode](https://github.com/anomalyco/opencode), from `packages/opencode`, run `bun dev` with `OPENCODE_CONFIG_CONTENT='{"plugin":[["file://<path-to-this-repo>/plugin",{"baseURL":"https://ai-gateway.amalitech-dev.net/v1"}]]}'` and `OPENCODE_TUI_CONFIG` pointing at a `tui.json` containing `{"plugin":["file://<path-to-this-repo>/plugin"]}`. Plugin diagnostics go to `~/.cache/amalicode/plugin.log`.

## Known limits

- The sidebar's `• OpenCode <version>` label, the exit-screen wordmark and `--help` text still say OpenCode; there is no slot for them.
- The terminal title is rewritten by wrapping the renderer's `setTerminalTitle`, not a public hook; if upstream renames it the title reverts to "OpenCode" and nothing breaks.
- `supports_reasoning` from the gateway is not mapped yet, so models get no reasoning-effort variants.
- No Windows installer (use WSL).
