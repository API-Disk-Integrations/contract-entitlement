/**
 * Contract Entitlement API client.
 *
 * Zero dependencies — uses the platform `fetch`, so it runs in Node 18+, Deno,
 * Bun and Cloudflare Workers without a bundler argument.
 *
 * NOT the browser: these endpoints need an API key and deliberately do not
 * support CORS. A key in front-end JavaScript is a published key.
 *
 * ```ts
 * const client = new ContractEntitlement()             // reads CONTRACT_ENTITLEMENT_API_KEY
 * const client = new ContractEntitlement({ apiKey: 'sp_live_…' })
 * ```
 *
 * Start free-key verification, then claim the token delivered by email:
 * ```
 * curl -X POST https://contractentitlement-api.com/v1/keys \
 *   -H 'content-type: application/json' -d '{"email":"you@example.com","source":{"source":"sdk","medium":"typescript"}}'
 * ```
 *
 * Every amount is an INTEGER number of minor units (cents). A fractional price
 * is rejected by the API rather than rounded.
 */

export const DEFAULT_BASE_URL = 'https://contractentitlement-api.com'

export type BillingFrequency = 'monthly' | 'quarterly' | 'annual' | 'one_time'

/** Branch on these rather than on the human-readable description. */
export type ObligationKind =
  /** Term end minus the notice period — the date that actually costs money. */
  | 'renewal_notice'
  | 'auto_renewal'
  | 'term_expiry'
  | 'minimum_commitment'
  /** A line item that ends before the contract does. */
  | 'entitlement_lapse'

export type ObligationStatus = 'upcoming' | 'due_soon' | 'passed'

export type CheckReason =
  | 'entitled'
  | 'sku_not_in_contract'
  | 'outside_contract_term'
  | 'outside_entitlement_window'
  | 'insufficient_quantity'

export interface LineItem {
  sku: string
  description?: string
  /** Whole units — seats, endpoints, licences. */
  quantity: number
  /** Per unit per billing period, integer minor units. */
  unitPriceMinor: number
  frequency: BillingFrequency
  /** Defaults to the contract start. Later means a mid-term addition. */
  startsAt?: string
  /** Defaults to the contract end. Earlier is flagged as an obligation. */
  endsAt?: string
}

export interface ContractInput {
  contractId: string
  customer: string
  supplier: string
  /** ISO-4217. Every amount is denominated in it. */
  currency: string
  startsAt: string
  /** The LAST DAY COVERED. "Through 31 December" means endsAt: '2026-12-31'. */
  endsAt: string
  lineItems: LineItem[]
  renewal?: {
    autoRenew: boolean
    /** Days of notice needed to STOP the renewal. This moves the real decision date. */
    noticeDays: number
    termMonths: number
    upliftCapPct?: number
  }
  commitment?: {
    minimumSpendMinor: number
    /** You track it — the service is stateless about your ledger. */
    spentToDateMinor?: number
  }
  metadata?: Record<string, string>
}

export interface BillingPeriod {
  periodStart: string
  periodEnd: string
  amountMinor: number
  prorated: boolean
}

export interface Entitlement {
  sku: string
  description?: string
  quantity: number
  unitPriceMinor: number
  frequency: BillingFrequency
  startsAt: string
  endsAt: string
  periods: number
  /** Always equals the sum of `schedule` amounts, exactly. */
  totalValueMinor: number
  /** Normalised to twelve months. One-time fees annualise to zero. */
  annualizedValueMinor: number
  schedule: BillingPeriod[]
}

export interface Obligation {
  kind: ObligationKind
  dueAt: string
  /** Negative once the date has passed. */
  daysRemaining: number
  status: ObligationStatus
  description: string
  amountMinor?: number
}

export interface RenewalAnalysis {
  autoRenew: boolean
  /** The real decision date: endsAt minus noticeDays. */
  noticeDeadline: string
  noticeWindowMissed: boolean
  daysToNoticeDeadline: number
  renewsOn: string | null
  renewalTermEndsAt: string | null
  /** Applied to ANNUALISED recurring value, not a raw sum of unit prices. */
  maxRenewalPriceMinor: number | null
  maxUpliftMinor: number | null
}

export interface CommitmentAnalysis {
  minimumSpendMinor: number
  spentToDateMinor: number
  remainingMinor: number
  requiredToDateMinor: number
  projectedSpendMinor: number
  projectedShortfallMinor: number
  onPace: boolean
}

export interface NormalizedContract {
  contractId: string
  customer: string
  supplier: string
  currency: string
  startsAt: string
  endsAt: string
  /** Inclusive of endsAt: 1 Jan to 31 Dec is 365, not 364. */
  termDays: number
  totalContractValueMinor: number
  annualizedValueMinor: number
  entitlements: Entitlement[]
  /** Sorted soonest first. */
  obligations: Obligation[]
  renewal: RenewalAnalysis | null
  commitment: CommitmentAnalysis | null
  evaluatedAt: string
  /** Structurally valid but worth a human's attention. */
  warnings: string[]
}

export interface EntitlementQuery {
  sku: string
  /** Defaults to 1. */
  quantity?: number
  /** Defaults to now. */
  at?: string
}

export interface EntitlementCheck {
  sku: string
  entitled: boolean
  availableQuantity: number
  requestedQuantity: number
  reason: CheckReason
  detail: string
  checkedAt: string
}

export type ApiErrorCode =
  | 'invalid_api_key' | 'missing_api_key' | 'quota_exceeded' | 'rate_limited'
  | 'invalid_request' | 'not_found' | 'method_not_allowed' | 'payload_too_large'
  | 'conflict' | 'internal_error'

/**
 * Thrown for any non-2xx response.
 *
 * NOT thrown when a check returns `entitled: false` — that is a successful
 * answer to a legitimate question. On a 400, `details.path` names the exact
 * field that failed validation.
 */
export class ApiError extends Error {
  // Declared as fields rather than constructor parameter properties: those are
  // unsupported by strip-only TypeScript runtimes (Node --experimental-strip-types),
  // and an SDK should run without a build step.
  readonly status: number
  readonly code: ApiErrorCode | 'unknown'
  readonly requestId?: string
  readonly details?: unknown

  constructor(status: number, code: ApiErrorCode | 'unknown', message: string, requestId?: string, details?: unknown) {
    super(`[${status} ${code}] ${message}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

export interface ClientOptions {
  apiKey?: string
  baseUrl?: string
  /** Milliseconds. Default 30000. */
  timeoutMs?: number
  fetch?: typeof fetch
}

/** Optional acquisition metadata. Invalid values are ignored by the service. */
export interface KeySource {
  source?: string
  medium?: string
  campaign?: string
  content?: string
}

export class ContractEntitlement {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: ClientOptions = {}) {
    const key = options.apiKey ?? (globalThis as any).process?.env?.CONTRACT_ENTITLEMENT_API_KEY
    if (!key) {
      throw new Error(
        'No API key. Pass { apiKey } or set CONTRACT_ENTITLEMENT_API_KEY. ' +
          'Request a free key verification email: POST ' + (options.baseUrl ?? DEFAULT_BASE_URL) + '/v1/keys',
      )
    }
    this.apiKey = key
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  private async request(method: string, path: string, body?: unknown, auth = true): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await this.fetchImpl(this.baseUrl + path, {
        method,
        signal: controller.signal,
        headers: {
          ...(auth ? { authorization: `Bearer ${this.apiKey}` } : {}),
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        const e = json?.error ?? {}
        throw new ApiError(res.status, e.code ?? 'unknown', e.message ?? text.slice(0, 200), e.requestId, e.details)
      }
      return json
    } finally {
      clearTimeout(timer)
    }
  }

  /** Liveness and deployed version. Does not require a key. */
  async health(): Promise<{ ok: boolean; product: string; version: string }> {
    return this.request('GET', '/health', undefined, false)
  }

  /**
   * Normalize one contract, or up to 100. Billed one unit per contract.
   */
  async normalize(
    contract: ContractInput | ContractInput[],
  ): Promise<{ count: number; contracts: NormalizedContract[]; requestId: string }> {
    return this.request('POST', '/v1/contracts', Array.isArray(contract) ? { contracts: contract } : { contract })
  }

  /**
   * Ask whether a SKU is covered, at a quantity, on a date.
   *
   * Billed one unit per CONTRACT, not per query — ask about 500 SKUs against one
   * contract for one unit.
   */
  async check(
    contract: ContractInput,
    query: EntitlementQuery | EntitlementQuery[],
  ): Promise<{ contractId: string; count: number; entitled: number; checks: EntitlementCheck[] }> {
    return this.request('POST', '/v1/entitlements/check',
      Array.isArray(query) ? { contract, queries: query } : { contract, query })
  }

  /** The real engine with no key: one contract, at most 20 line items. */
  async demoNormalize(contract: ContractInput): Promise<{ contract: NormalizedContract }> {
    return this.request('POST', '/v1/demo/normalize', { contract }, false)
  }

  /** Every obligation kind, status and check reason code, with meanings. */
  async obligationTypes(): Promise<Record<string, unknown>> {
    return this.request('GET', '/v1/obligation-types', undefined, false)
  }

  /** Request a free sandbox key; this emails a claim token. Claiming returns the key once. */
  static async createKey(email: string, opts: { baseUrl?: string; name?: string; source?: KeySource } = {}): Promise<any> {
    const res = await fetch((opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '') + '/v1/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        ...(opts.name ? { name: opts.name } : {}),
        source: opts.source ?? { source: 'sdk', medium: 'typescript' },
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'unknown', json?.error?.message ?? 'failed', json?.error?.requestId)
    return json
  }
}

export default ContractEntitlement

// ---8<--- BEGIN GENERATED BY tools/gen-sdk.mjs — DO NOT EDIT BELOW ---8<---
// Everything between these markers is written from openapi.json. Change the
// service, regenerate the contract, then re-run `npm run gen:sdk`.

/** The contract this SDK was generated from. */
export const API_TITLE = "Contract Entitlement API"
export const API_VERSION = "1.0.0"
/** The origin the published contract names. `DEFAULT_BASE_URL` resolves to this unless overridden. */
export const API_BASE_URL = "https://contractentitlement-api.com"

/**
 * Every `error.code` the contract publishes.
 *
 * The runtime companion to the `ApiErrorCode` union: a union is erased at
 * compile time, so a caller wanting to test an unknown string against the
 * documented set had nothing to test it with.
 */
export const ERROR_CODES = ["invalid_api_key", "missing_api_key", "quota_exceeded", "rate_limited", "invalid_request", "not_found", "method_not_allowed", "payload_too_large", "conflict", "internal_error"] as const

/** One published operation, exactly as the contract describes it. */
export interface OperationDescriptor {
  readonly operationId: string
  readonly method: string
  readonly path: string
  readonly summary: string
  /** True when the operation requires an API key. False does NOT mean public — see `authKind`. */
  readonly auth: boolean
  /**
   * The credential the operation actually takes.
   *
   * `api_key` — the bearer token this client sends.
   * `session` — the dashboard session cookie, plus `x-csrf-token` on writes.
   *             An API key is REFUSED: these endpoints change what you are
   *             billed and read your payment history, and a key that lives
   *             in CI must not reach them. Call them from the signed-in
   *             dashboard, not from this SDK.
   * `signature` — machine-to-machine; not callable by API consumers.
   * `public` — no credential at all.
   */
  readonly authKind: 'api_key' | 'session' | 'signature' | 'public'
  readonly pathParams: readonly string[]
  readonly queryParams: readonly string[]
  readonly requiredBodyFields: readonly string[]
  readonly successStatus: number | null
  /** Property names of the documented 2xx body. A field absent here is a field the service does not promise. */
  readonly responseFields: readonly string[]
}

/**
 * The published surface, generated. Ships with the client so an integration
 * can assert against the contract instead of against a changelog.
 */
export const OPERATIONS: readonly OperationDescriptor[] = [
  {
    operationId: "get/",
    method: "GET",
    path: "/",
    summary: "Service index — endpoints, auth and error format",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: [],
  },
  {
    operationId: "postApiBillingWebhook",
    method: "POST",
    path: "/api/billing/webhook",
    summary: "Square billing events, forwarded by the shared hub",
    auth: false,
    authKind: "signature",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: [],
  },
  {
    operationId: "getHealth",
    method: "GET",
    path: "/health",
    summary: "Liveness and deployed version",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: [],
  },
  {
    operationId: "postV1Checkout",
    method: "POST",
    path: "/v1/checkout",
    summary: "Start a hosted Square checkout for a paid tier",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: ["tier"],
    successStatus: 200,
    responseFields: ["checkoutUrl", "tier", "sku", "requestId"],
  },
  {
    operationId: "postV1Contracts",
    method: "POST",
    path: "/v1/contracts",
    summary: "Normalize contracts into entitlements, obligations and schedules",
    auth: true,
    authKind: "api_key",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["count", "contracts"],
  },
  {
    operationId: "postV1DemoNormalize",
    method: "POST",
    path: "/v1/demo/normalize",
    summary: "Public demo — normalize one contract without a key",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: ["contract"],
    successStatus: 200,
    responseFields: [],
  },
  {
    operationId: "postV1EntitlementsCheck",
    method: "POST",
    path: "/v1/entitlements/check",
    summary: "Ask whether a customer is entitled to a SKU, right now",
    auth: true,
    authKind: "api_key",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: ["contract"],
    successStatus: 200,
    responseFields: ["count", "entitled", "checks"],
  },
  {
    operationId: "getV1Invoices",
    method: "GET",
    path: "/v1/invoices",
    summary: "Every invoice issued against this account, newest first (dashboard session required)",
    auth: false,
    authKind: "session",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["product", "count", "note", "invoices", "requestId"],
  },
  {
    operationId: "getV1Keys",
    method: "GET",
    path: "/v1/keys",
    summary: "List your API keys for this API",
    auth: true,
    authKind: "api_key",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["product", "accountId", "keys", "requestId"],
  },
  {
    operationId: "postV1Keys",
    method: "POST",
    path: "/v1/keys",
    summary: "Request a free sandbox API key (sends a verification email)",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: ["email"],
    successStatus: 202,
    responseFields: ["status", "email", "expiresAt", "next", "message", "requestId"],
  },
  {
    operationId: "postV1KeysIdRevoke",
    method: "POST",
    path: "/v1/keys/{id}/revoke",
    summary: "Revoke one of your API keys",
    auth: true,
    authKind: "api_key",
    pathParams: ["id"],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["id", "status", "message", "requestId"],
  },
  {
    operationId: "postV1KeysIdRotate",
    method: "POST",
    path: "/v1/keys/{id}/rotate",
    summary: "Replace one of your API keys with a new secret",
    auth: true,
    authKind: "api_key",
    pathParams: ["id"],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 201,
    responseFields: ["apiKey", "keyId", "replaced", "product", "quotaPerPeriod", "plan", "warning", "requestId"],
  },
  {
    operationId: "postV1KeysClaim",
    method: "POST",
    path: "/v1/keys/claim",
    summary: "Exchange an emailed claim token for the API key",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: ["token"],
    successStatus: 201,
    responseFields: ["apiKey", "keyId", "product", "quotaPerPeriod", "plan", "warning", "usage", "requestId"],
  },
  {
    operationId: "getV1ObligationTypes",
    method: "GET",
    path: "/v1/obligation-types",
    summary: "Every obligation kind and reason code the engine emits",
    auth: false,
    authKind: "public",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: [],
  },
  {
    operationId: "getV1Payments",
    method: "GET",
    path: "/v1/payments",
    summary: "Every payment attempted against this account and how it went (dashboard session required)",
    auth: false,
    authKind: "session",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["product", "count", "note", "payments", "requestId"],
  },
  {
    operationId: "getV1Subscription",
    method: "GET",
    path: "/v1/subscription",
    summary: "Your current plan, billing window and available changes (dashboard session required)",
    auth: false,
    authKind: "session",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["product", "subscribed", "status", "plan", "pendingPlan", "planChangesGoThrough", "baseFeeOwner", "cancellation", "tiers", "requestId"],
  },
  {
    operationId: "postV1SubscriptionCancel",
    method: "POST",
    path: "/v1/subscription/cancel",
    summary: "Cancel this plan and end metered access (dashboard session required)",
    auth: false,
    authKind: "session",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["canceled", "canceledAt", "entitlement", "money", "finalInvoice", "requestId"],
  },
  {
    operationId: "postV1SubscriptionPlan",
    method: "POST",
    path: "/v1/subscription/plan",
    summary: "Upgrade or downgrade to another plan (dashboard session required)",
    auth: false,
    authKind: "session",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: ["planId"],
    successStatus: 200,
    responseFields: ["changed", "direction", "from", "to", "entitlement", "billing", "requestId"],
  },
  {
    operationId: "getV1Usage",
    method: "GET",
    path: "/v1/usage",
    summary: "Your consumption and remaining allowance for this period",
    auth: true,
    authKind: "api_key",
    pathParams: [],
    queryParams: [],
    requiredBodyFields: [],
    successStatus: 200,
    responseFields: ["product", "tier", "status", "unit", "period", "included", "used", "ceiling", "remaining", "overageSoFarMinor", "spendCapMinor", "requestId"],
  },
]
// ---8<--- END GENERATED BY tools/gen-sdk.mjs ---8<---
