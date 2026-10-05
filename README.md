# AmaliCode

AmaliCode is unmodified [OpenCode](https://github.com/anomalyco/opencode) (MIT), locked to the AmaliAI gateway and branded through OpenCode's public plugin API. This repo holds only the plugin, launcher and installer; the OpenCode binary is the official upstream release, so taking an upstream release is a version bump, not a merge.

## Install

### Windows

In PowerShell (no admin rights needed):

```powershell
irm https://github.com/Clifford-Kwakye/amalicode/releases/latest/download/install.ps1 | iex
```

For the dev gateway instead of prod:

```powershell
& ([scriptblock]::Create((irm https://github.com/Clifford-Kwakye/amalicode/releases/latest/download/install.ps1))) -Channel dev
```

Then open a new terminal (PowerShell, Command Prompt or Windows Terminal) so `amalicode` is on your PATH. Needs 64-bit Windows 10 version 1803 or later.

### Linux, macOS or WSL

```bash
curl -fsSL https://github.com/Clifford-Kwakye/amalicode/releases/latest/download/install.sh | bash
```

For the dev gateway instead of prod:

```bash
curl -fsSL https://github.com/Clifford-Kwakye/amalicode/releases/latest/download/install.sh | bash -s -- --channel dev
```

Then open a new terminal so `amalicode` is on your PATH.

## Use

Start AmaliCode in the project you want to work on:

```bash
cd ~/projects/my-app
amalicode
```

On Windows, the same in PowerShell, Command Prompt or Windows Terminal:

```powershell
cd $HOME\projects\my-app
amalicode
```

The first launch asks for your AmaliAI key. Create one on the AmaliAI dashboard and paste it in. It is saved in `~/.local/share/opencode/auth.json` (on Windows, `%USERPROFILE%\.local\share\opencode\auth.json`), so you are only asked once. To use a key without saving it, set `AMALICODE_API_KEY` instead.

| Command | What it does |
|---|---|
| `amalicode` | Opens AmaliCode in the current directory |
| `amalicode <dir>` | Opens AmaliCode in another directory |
| `amalicode run "<prompt>"` | Runs one prompt without opening the interface |
| `amalicode upgrade` | Updates to the latest AmaliCode release, keeping your gateway (prod or dev) |
| `amalicode upgrade --channel dev` | Updates and switches to the dev gateway (`--channel prod` switches back) |
| `amalicode --version` | Shows the AmaliCode and OpenCode versions |
| `amalicode auth login --provider amaliai` | Replaces your saved key |

Every other `opencode` command and flag works the same through `amalicode`.

If no models show up, or you see "No provider selected", check that you are on the VPN and that your key is valid, then look at `~/.cache/amalicode/plugin.log` (on Windows, `%USERPROFILE%\.cache\amalicode\plugin.log`).

## Uninstall

To also remove your saved key, run `amalicode auth logout amaliai` first.

On Windows, in PowerShell:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.amalicode", "$env:USERPROFILE\.cache\amalicode"
```

Then remove `%USERPROFILE%\.amalicode\bin` from your user `Path` (Start → "Edit environment variables for your account").

On Linux, macOS or WSL:

```bash
rm -rf ~/.amalicode ~/.cache/amalicode
```

After that, delete the `# AmaliCode` PATH line the installer added to `~/.bashrc`, `~/.zshrc` or `~/.config/fish/config.fish` (or the `~/.local/bin/amalicode` link, if that is where it went).

## Pieces

Everything is installed into `~/.amalicode` (`%USERPROFILE%\.amalicode` on Windows; `AMALICODE_HOME` overrides). From a checkout, `./install.sh --channel dev` (or `.\install.ps1 -Channel dev` on Windows) installs the files beside it instead of downloading a release.

| Path | What it does |
|---|---|
| `install.sh` | Downloads the pinned OpenCode release from upstream GitHub, installs the plugin and launcher into `~/.amalicode`, adds `amalicode` to PATH |
| `install.ps1` | The same for Windows (Windows PowerShell 5.1); adds `bin` to the user `Path` |
| `script/release.sh` | Builds the release assets: stamped `install.sh` and `install.ps1`, `amalicode-bundle.tar.gz`, `SHA256SUMS` |
| `launcher/amalicode` | Runs the pinned binary with the plugin injected via `OPENCODE_CONFIG_CONTENT` / `OPENCODE_TUI_CONFIG`; prompts for a key on first launch (offline check only) |
| `launcher/amalicode.cmd` | The same for Windows, as a batch file so it runs under the default execution policy |
| `plugin/src/server.ts` | `config` hook: registers the `amaliai` provider, fills models from the gateway, forces `enabled_providers: ["amaliai"]` and `autoupdate: false`. `auth` hook: API-key login |
| `plugin/src/gateway.ts` | `/v1/models` + `/v1/model/info`: per-key model scoping, limits, per-million pricing, mode filtering |
| `plugin/src/tui.tsx` | `home_logo` slot (wordmark), brand theme, terminal title |

## Releasing

The install one-liner downloads from the latest GitHub release, so it returns 404 until at least one release exists. To publish one, tag `main` and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Use the next version for each later release. `.github/workflows/release.yml` tests the plugin, runs `script/release.sh` to stamp `install.sh` with that release's URLs and pack `amalicode-bundle.tar.gz`, smoke-tests the installers on Linux and Windows, and publishes the assets with `SHA256SUMS`.

To take a new upstream OpenCode release: install it with `./install.sh --version <new>`, run the evaluation set, then change `OPENCODE_VERSION` in `install.sh` and `$OpenCodeVersion` in `install.ps1` (CI fails if they differ) and tag a release. The contract with upstream is the plugin API (`@opencode-ai/plugin`), the `config`/`auth` hooks, the `home_logo` slot, and the `OPENCODE_CONFIG_CONTENT` / `OPENCODE_TUI_CONFIG` variables.

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
- Windows on ARM installs the arm64 OpenCode build, which has not been tested.
