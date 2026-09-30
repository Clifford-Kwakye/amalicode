import type { Config, Plugin, PluginOptions } from "@opencode-ai/plugin"
import os from "os"
import path from "path"
import { API_KEY_ENV, GATEWAY, PROVIDER_ID, PROVIDER_NAME, keyFromEnv, loadCatalog, type Catalog } from "./gateway"

/**
 * Server half of AmaliCode: registers the AmaliAI provider, fills its model
 * list from the gateway, and hides every other provider.
 *
 * The provider has to be injected through the `config` hook. OpenCode's
 * `provider.models` hook only runs for providers already in the models.dev
 * catalogue, and `amaliai` is not in it, so that hook would never fire.
 */
const server: Plugin = async (_input, options) => {
  const baseURL = resolveBaseURL(options)
  return {
    config: async (cfg) => {
      const key = keyFromEnv() ?? (await storedKey())
      const catalog = await catalogFor(baseURL, key)
      lock(cfg, baseURL, catalog)
    },
    auth: {
      provider: PROVIDER_ID,
      methods: [{ type: "api", label: "AmaliAI API key" }],
    },
  }
}

export default { id: "amaliai", server }

/**
 * Applied last, so it wins over every config file: a user or project that
 * enables another provider still gets only AmaliAI, because both provider
 * paths (the provider service and the Connect dialog) read this same config
 * object after the hook. Autoupdate is off because the launcher pins the
 * OpenCode version; upgrades go through `amalicode upgrade` after evaluation.
 */
function lock(cfg: Config, baseURL: string, catalog: Catalog) {
  cfg.autoupdate = false
  cfg.enabled_providers = [PROVIDER_ID]
  cfg.disabled_providers = []
  cfg.provider = {
    [PROVIDER_ID]: {
      name: PROVIDER_NAME,
      npm: "@ai-sdk/openai-compatible",
      api: baseURL,
      env: [API_KEY_ENV],
      options: { baseURL },
      models: catalog.models,
    },
  }
}

/** `AMALICODE_BASE_URL` wins so backend work can point at a local gateway; otherwise the installer's choice. */
export function resolveBaseURL(options: PluginOptions | undefined, env: Record<string, string | undefined> = process.env) {
  const configured = env["AMALICODE_BASE_URL"]?.trim() || (typeof options?.baseURL === "string" ? options.baseURL : "")
  return (configured || GATEWAY.dev).replace(/\/+$/, "")
}

/**
 * Stale-while-revalidate. A cached catalogue is returned immediately and
 * refreshed in the background for next start, because this hook blocks the
 * provider list and the gateway is VPN-gated. Only a first run waits on the
 * network, and even then it falls back to an empty list rather than hanging.
 */
export async function catalogFor(baseURL: string, key: string | undefined, dir = cacheDir()): Promise<Catalog> {
  // Without a key the gateway can only answer 401. This happens on first run,
  // when `auth login` boots OpenCode before a key exists.
  if (!key) return { models: {}, described: false }
  const file = Bun.file(path.join(dir, `catalog-${fingerprint(baseURL, key)}.json`))
  const refresh = loadCatalog(baseURL, key).then(async (catalog) => {
    await Bun.write(file, JSON.stringify(catalog))
    return catalog
  })
  const cached = (await file.exists()) ? ((await file.json().catch(() => undefined)) as Catalog | undefined) : undefined
  if (cached) {
    refresh.catch((error) => log(`refresh failed, using cached models: ${error.message}`))
    return cached
  }
  return refresh.catch((error) => {
    log(`could not load models from ${baseURL}: ${error.message}. Check the stored key with: amalicode auth list`)
    return { models: {}, described: false }
  })
}

/** Reads the key `opencode auth login` stored, from OpenCode's own credential file. */
export async function storedKey(file = path.join(dataDir(), "auth.json")) {
  const auth = (await Bun.file(file)
    .json()
    .catch(() => ({}))) as Record<string, { type?: string; key?: string }>
  const entry = auth[PROVIDER_ID]
  if (entry?.type !== "api") return
  return entry.key?.trim() || undefined
}

/** Models are scoped per key, so each key and gateway gets its own cache entry. */
function fingerprint(baseURL: string, key: string | undefined) {
  return new Bun.CryptoHasher("sha256")
    .update(`${baseURL}\n${key ?? ""}`)
    .digest("hex")
    .slice(0, 16)
}

// Mirrors xdg-basedir, which OpenCode uses for its own directories.
function dataDir() {
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "opencode")
}

function cacheDir() {
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "amalicode")
}

// stderr would tear through the TUI, so the plugin logs to its own file.
function log(message: string) {
  const line = `${new Date().toISOString()} amaliai: ${message}\n`
  const file = path.join(cacheDir(), "plugin.log")
  Bun.file(file)
    .text()
    .catch(() => "")
    .then((prev) => Bun.write(file, prev + line))
    .catch(() => {})
}
