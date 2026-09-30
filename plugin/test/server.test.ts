import { afterAll, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { FALLBACK_LIMIT, keyFromEnv, loadCatalog, perMillion } from "../src/gateway"
import plugin, { catalogFor, resolveBaseURL, storedKey } from "../src/server"

// A stand-in gateway speaking LiteLLM's shapes; each test picks its behaviour by path prefix.
const state = { outage: false }
const gateway = Bun.serve({
  port: 0,
  fetch(request) {
    const url = new URL(request.url)
    const [, scenario, ...rest] = url.pathname.split("/")
    const route = "/" + rest.join("/")
    if (scenario === "down" || state.outage) return new Response("nope", { status: 503 })
    if (request.headers.get("authorization") !== "Bearer sk-good") return new Response("no", { status: 401 })
    if (route === "/v1/models")
      return Response.json({
        data: [
          { id: "claude-sonnet-4-6" },
          { id: "qwen3p7-plus" },
          { id: "text-embedding-3-small" },
          { id: "deepgram/nova-3" },
        ],
      })
    if (route === "/v1/model/info" && scenario === "litellm")
      return Response.json({
        data: [
          {
            model_name: "claude-sonnet-4-6",
            model_info: {
              max_input_tokens: 1_050_000,
              max_output_tokens: 64_000,
              input_cost_per_token: 0.000003,
              output_cost_per_token: 0.000015,
              cache_read_input_token_cost: 0.0000003,
              mode: "chat",
              supports_vision: true,
              supports_pdf_input: true,
            },
          },
          { model_name: "deepgram/nova-3", model_info: { mode: "audio_transcription", input_cost_per_token: 0 } },
        ],
      })
    return new Response("not found", { status: 404 })
  },
})
const base = (scenario: string) => `http://localhost:${gateway.port}/${scenario}/v1`
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "amalicode-test-"))
afterAll(async () => {
  gateway.stop(true)
  await fs.rm(tmp, { recursive: true, force: true })
})

describe("loadCatalog", () => {
  test("uses /v1/model/info limits, prices and modes; drops embeddings and transcription", async () => {
    const catalog = await loadCatalog(base("litellm"), "sk-good")
    expect(catalog.described).toBe(true)
    expect(Object.keys(catalog.models).sort()).toEqual(["claude-sonnet-4-6", "qwen3p7-plus"])
    expect(catalog.models["claude-sonnet-4-6"]).toEqual({
      name: "claude-sonnet-4-6",
      tool_call: true,
      attachment: true,
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
      limit: { context: 1_050_000, output: 64_000 },
      cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 0 },
    })
    // Reported without info: defaulted limits and no invented price.
    expect(catalog.models["qwen3p7-plus"]).toEqual({ name: "qwen3p7-plus", tool_call: true, limit: FALLBACK_LIMIT })
  })

  test("treats a 404 on /v1/model/info as an ordinary OpenAI-compatible host", async () => {
    const catalog = await loadCatalog(base("plain"), "sk-good")
    expect(catalog.described).toBe(false)
    // Without modes only the embedding can be recognised by name.
    expect(Object.keys(catalog.models).sort()).toEqual(["claude-sonnet-4-6", "deepgram/nova-3", "qwen3p7-plus"])
  })

  test("throws on a rejected key so the empty list is explained", async () => {
    expect(loadCatalog(base("litellm"), "sk-bad")).rejects.toThrow("401")
  })
})

test("perMillion rounds away float noise", () => {
  expect(perMillion(0.0000004)).toBe(0.4)
  expect(perMillion(undefined)).toBe(0)
})

test("keyFromEnv treats empty and whitespace as absent", () => {
  expect(keyFromEnv({ AMALICODE_API_KEY: "" })).toBeUndefined()
  expect(keyFromEnv({ AMALICODE_API_KEY: "  " })).toBeUndefined()
  expect(keyFromEnv({ AMALICODE_API_KEY: " sk-good " })).toBe("sk-good")
})

test("resolveBaseURL prefers the env override, then plugin options, then dev", () => {
  expect(resolveBaseURL({ baseURL: "https://prod/v1/" }, { AMALICODE_BASE_URL: "http://local/v1" })).toBe(
    "http://local/v1",
  )
  expect(resolveBaseURL({ baseURL: "https://prod/v1/" }, {})).toBe("https://prod/v1")
  expect(resolveBaseURL(undefined, { AMALICODE_BASE_URL: " " })).toBe("https://ai-gateway.amalitech-dev.net/v1")
})

test("storedKey reads only an api credential for amaliai", async () => {
  const file = path.join(tmp, "auth.json")
  await Bun.write(file, JSON.stringify({ amaliai: { type: "api", key: "sk-good" }, openai: { type: "api", key: "x" } }))
  expect(await storedKey(file)).toBe("sk-good")
  await Bun.write(file, JSON.stringify({ amaliai: { type: "oauth", access: "x" } }))
  expect(await storedKey(file)).toBeUndefined()
  expect(await storedKey(path.join(tmp, "missing.json"))).toBeUndefined()
})

describe("catalogFor", () => {
  test("serves the cache when the gateway is unreachable", async () => {
    const dir = path.join(tmp, "cache-swr")
    const fresh = await catalogFor(base("litellm"), "sk-good", dir)
    expect(Object.keys(fresh.models)).toHaveLength(2)
    state.outage = true
    const cached = await catalogFor(base("litellm"), "sk-good", dir)
    state.outage = false
    expect(cached).toEqual(fresh)
    // A different key must not see another key's models.
    const other = await catalogFor(base("litellm"), "sk-bad", dir)
    expect(other.models).toEqual({})
  })

  test("does not call the gateway without a key", async () => {
    const catalog = await catalogFor(base("litellm"), undefined, path.join(tmp, "cache-nokey"))
    expect(catalog).toEqual({ models: {}, described: false })
    expect(await Bun.file(path.join(tmp, "cache-nokey")).exists()).toBe(false)
  })

  test("returns an empty catalogue instead of throwing on first run", async () => {
    const catalog = await catalogFor(base("down"), "sk-good", path.join(tmp, "cache-empty"))
    expect(catalog).toEqual({ models: {}, described: false })
  })
})

test("config hook injects only AmaliAI and overrides user provider choices", async () => {
  const hooks = await plugin.server({} as never, { baseURL: base("litellm") })
  const cfg: {
    autoupdate: boolean
    enabled_providers: string[]
    disabled_providers: string[]
    provider: Record<string, { models?: object }>
  } = {
    autoupdate: true,
    enabled_providers: ["openai"],
    disabled_providers: ["amaliai"],
    provider: { openai: {} },
  }
  process.env.AMALICODE_API_KEY = "sk-good"
  await hooks.config!(cfg as never)
  delete process.env.AMALICODE_API_KEY
  expect(cfg.autoupdate).toBe(false)
  expect(cfg.enabled_providers).toEqual(["amaliai"])
  expect(cfg.disabled_providers).toEqual([])
  expect(Object.keys(cfg.provider)).toEqual(["amaliai"])
  expect(Object.keys(cfg.provider.amaliai.models ?? {})).toHaveLength(2)
})
