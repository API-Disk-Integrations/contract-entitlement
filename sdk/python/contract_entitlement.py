"""
Contract Entitlement API client.

Zero dependencies beyond the standard library — no requests, no httpx — so it
drops into any environment without a dependency negotiation.

    from contract_entitlement import ContractEntitlement

    client = ContractEntitlement()            # reads CONTRACT_ENTITLEMENT_API_KEY
    client = ContractEntitlement("sp_live_…") # or pass it explicitly

Start free-key verification, then claim the token delivered by email:

    curl -X POST https://contractentitlement-api.com/v1/keys \
      -H 'content-type: application/json' -d '{"email":"you@example.com","source":{"source":"sdk","medium":"python"}}'

Every amount is an INTEGER number of minor units (cents). A fractional price is
rejected by the API rather than rounded — a contract value is the last place a
floating-point cent belongs.
"""

from __future__ import annotations

import json as _json
import os
import urllib.error
import urllib.request

__all__ = ["ContractEntitlement", "ApiError", "OBLIGATION_KINDS", "CHECK_REASONS", "FREQUENCIES", "API_TITLE", "API_VERSION", "API_BASE_URL", "ERROR_CODES", "OPERATIONS"]

DEFAULT_BASE_URL = "https://contractentitlement-api.com"

FREQUENCIES = ("monthly", "quarterly", "annual", "one_time")

#: Branch on these rather than on the human-readable description.
OBLIGATION_KINDS = (
    "renewal_notice",       # term end minus notice period — the date that costs money
    "auto_renewal",
    "term_expiry",
    "minimum_commitment",
    "entitlement_lapse",    # a line item that ends before the contract does
)

CHECK_REASONS = (
    "entitled",
    "sku_not_in_contract",
    "outside_contract_term",
    "outside_entitlement_window",
    "insufficient_quantity",
)


class ApiError(Exception):
    """
    Raised for any non-2xx response.

    NOT raised when a check comes back ``entitled: False`` — that is a
    successful answer to a legitimate question. On a 400, ``details["path"]``
    names the exact field that failed validation.
    """

    def __init__(self, status: int, code: str, message: str, request_id: str | None = None, details=None):
        super().__init__(f"[{status} {code}] {message}")
        self.status = status
        self.code = code
        self.message = message
        self.request_id = request_id
        self.details = details


class ContractEntitlement:
    def __init__(self, api_key: str | None = None, *, base_url: str = DEFAULT_BASE_URL, timeout: float = 30.0):
        key = api_key or os.environ.get("CONTRACT_ENTITLEMENT_API_KEY")
        if not key:
            raise ValueError(
                "No API key. Pass one to ContractEntitlement(...) or set "
                "CONTRACT_ENTITLEMENT_API_KEY. Request a free key verification email: POST "
                '{}/v1/keys with {{"email": "you@example.com"}}'.format(base_url)
            )
        self.api_key = key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    # -- transport ---------------------------------------------------------
    def _request(self, method: str, path: str, *, body=None, auth: bool = True) -> dict:
        data = _json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base_url + path, data=data, method=method)
        if auth:
            req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("Accept", "application/json")
        if data:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return _json.loads(res.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            try:
                err = _json.loads(raw).get("error", {})
            except Exception:
                err = {}
            raise ApiError(
                e.code, err.get("code", "unknown"), err.get("message", raw[:200]),
                err.get("requestId"), err.get("details"),
            ) from None

    # -- API ---------------------------------------------------------------
    def health(self) -> dict:
        """Liveness and deployed version. Does not require a key."""
        return self._request("GET", "/health", auth=False)

    def normalize(self, contract_or_contracts) -> dict:
        """
        Normalize one contract, or a list of up to 100.

        Billed one unit per contract. Returns entitlements with an exact billing
        schedule, dated obligations, renewal analysis and commitment pace.
        """
        body = (
            {"contracts": contract_or_contracts}
            if isinstance(contract_or_contracts, list)
            else {"contract": contract_or_contracts}
        )
        return self._request("POST", "/v1/contracts", body=body)

    def check(self, contract: dict, query_or_queries) -> dict:
        """
        Ask whether a SKU is covered, at a quantity, on a date.

        Billed one unit per CONTRACT, not per query — ask about 500 SKUs against
        one contract for one unit. Each answer carries a reason code, because a
        SKU absent from the contract, a lapsed window and an insufficient
        quantity are three different conversations.
        """
        body: dict = {"contract": contract}
        if isinstance(query_or_queries, list):
            body["queries"] = query_or_queries
        else:
            body["query"] = query_or_queries
        return self._request("POST", "/v1/entitlements/check", body=body)

    def demo_normalize(self, contract: dict) -> dict:
        """The real engine with no key: one contract, at most 20 line items."""
        return self._request("POST", "/v1/demo/normalize", body={"contract": contract}, auth=False)

    def obligation_types(self) -> dict:
        """Every obligation kind, status and check reason code, with meanings."""
        return self._request("GET", "/v1/obligation-types", auth=False)

    @staticmethod
    def create_key(
        email: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        name: str | None = None,
        source: dict[str, str] | None = None,
    ) -> dict:
        """Request a free sandbox key; this emails a claim token. Claiming returns the key once."""
        payload: dict = {
            "email": email,
            "source": source if source is not None else {"source": "sdk", "medium": "python"},
        }
        if name:
            payload["name"] = name
        req = urllib.request.Request(
            base_url.rstrip("/") + "/v1/keys", data=_json.dumps(payload).encode(), method="POST"
        )
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=30) as res:
            return _json.loads(res.read().decode())

# ---8<--- BEGIN GENERATED BY tools/gen-sdk.mjs — DO NOT EDIT BELOW ---8<---
# Everything between these markers is written from openapi.json. Change the
# service, regenerate the contract, then re-run `npm run gen:sdk`.

#: The contract this SDK was generated from.
API_TITLE = "Contract Entitlement API"
API_VERSION = "1.0.0"
#: The origin the published contract names.
API_BASE_URL = "https://contractentitlement-api.com"

#: Every ``error.code`` the contract publishes. Branch on these, never on the message.
ERROR_CODES = ("invalid_api_key", "missing_api_key", "quota_exceeded", "rate_limited", "invalid_request", "not_found", "method_not_allowed", "payload_too_large", "conflict", "internal_error")

#: The published surface, generated. Ships with the client so an integration
#: can assert against the contract instead of against a changelog.
OPERATIONS = (
    {
        "operation_id": "get/",
        "method": "GET",
        "path": "/",
        "summary": "Service index — endpoints, auth and error format",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": (),
    },
    {
        "operation_id": "postApiBillingWebhook",
        "method": "POST",
        "path": "/api/billing/webhook",
        "summary": "Square billing events, forwarded by the shared hub",
        "auth": False,
        "auth_kind": "signature",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": (),
    },
    {
        "operation_id": "getHealth",
        "method": "GET",
        "path": "/health",
        "summary": "Liveness and deployed version",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": (),
    },
    {
        "operation_id": "postV1Checkout",
        "method": "POST",
        "path": "/v1/checkout",
        "summary": "Start a hosted Square checkout for a paid tier",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": ("tier",),
        "success_status": 200,
        "response_fields": ("checkoutUrl", "tier", "sku", "requestId"),
    },
    {
        "operation_id": "postV1Contracts",
        "method": "POST",
        "path": "/v1/contracts",
        "summary": "Normalize contracts into entitlements, obligations and schedules",
        "auth": True,
        "auth_kind": "api_key",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("count", "contracts"),
    },
    {
        "operation_id": "postV1DemoNormalize",
        "method": "POST",
        "path": "/v1/demo/normalize",
        "summary": "Public demo — normalize one contract without a key",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": ("contract",),
        "success_status": 200,
        "response_fields": (),
    },
    {
        "operation_id": "postV1EntitlementsCheck",
        "method": "POST",
        "path": "/v1/entitlements/check",
        "summary": "Ask whether a customer is entitled to a SKU, right now",
        "auth": True,
        "auth_kind": "api_key",
        "path_params": (),
        "query_params": (),
        "required_body_fields": ("contract",),
        "success_status": 200,
        "response_fields": ("count", "entitled", "checks"),
    },
    {
        "operation_id": "getV1Invoices",
        "method": "GET",
        "path": "/v1/invoices",
        "summary": "Every invoice issued against this account, newest first (dashboard session required)",
        "auth": False,
        "auth_kind": "session",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("product", "count", "note", "invoices", "requestId"),
    },
    {
        "operation_id": "getV1Keys",
        "method": "GET",
        "path": "/v1/keys",
        "summary": "List your API keys for this API",
        "auth": True,
        "auth_kind": "api_key",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("product", "accountId", "keys", "requestId"),
    },
    {
        "operation_id": "postV1Keys",
        "method": "POST",
        "path": "/v1/keys",
        "summary": "Request a free sandbox API key (sends a verification email)",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": ("email",),
        "success_status": 202,
        "response_fields": ("status", "email", "expiresAt", "next", "message", "requestId"),
    },
    {
        "operation_id": "postV1KeysIdRevoke",
        "method": "POST",
        "path": "/v1/keys/{id}/revoke",
        "summary": "Revoke one of your API keys",
        "auth": True,
        "auth_kind": "api_key",
        "path_params": ("id",),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("id", "status", "message", "requestId"),
    },
    {
        "operation_id": "postV1KeysIdRotate",
        "method": "POST",
        "path": "/v1/keys/{id}/rotate",
        "summary": "Replace one of your API keys with a new secret",
        "auth": True,
        "auth_kind": "api_key",
        "path_params": ("id",),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 201,
        "response_fields": ("apiKey", "keyId", "replaced", "product", "quotaPerPeriod", "plan", "warning", "requestId"),
    },
    {
        "operation_id": "postV1KeysClaim",
        "method": "POST",
        "path": "/v1/keys/claim",
        "summary": "Exchange an emailed claim token for the API key",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": ("token",),
        "success_status": 201,
        "response_fields": ("apiKey", "keyId", "product", "quotaPerPeriod", "plan", "warning", "usage", "requestId"),
    },
    {
        "operation_id": "getV1ObligationTypes",
        "method": "GET",
        "path": "/v1/obligation-types",
        "summary": "Every obligation kind and reason code the engine emits",
        "auth": False,
        "auth_kind": "public",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": (),
    },
    {
        "operation_id": "getV1Payments",
        "method": "GET",
        "path": "/v1/payments",
        "summary": "Every payment attempted against this account and how it went (dashboard session required)",
        "auth": False,
        "auth_kind": "session",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("product", "count", "note", "payments", "requestId"),
    },
    {
        "operation_id": "getV1Subscription",
        "method": "GET",
        "path": "/v1/subscription",
        "summary": "Your current plan, billing window and available changes (dashboard session required)",
        "auth": False,
        "auth_kind": "session",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("product", "subscribed", "status", "plan", "pendingPlan", "planChangesGoThrough", "baseFeeOwner", "cancellation", "tiers", "requestId"),
    },
    {
        "operation_id": "postV1SubscriptionCancel",
        "method": "POST",
        "path": "/v1/subscription/cancel",
        "summary": "Cancel this plan and end metered access (dashboard session required)",
        "auth": False,
        "auth_kind": "session",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("canceled", "canceledAt", "entitlement", "money", "finalInvoice", "requestId"),
    },
    {
        "operation_id": "postV1SubscriptionPlan",
        "method": "POST",
        "path": "/v1/subscription/plan",
        "summary": "Upgrade or downgrade to another plan (dashboard session required)",
        "auth": False,
        "auth_kind": "session",
        "path_params": (),
        "query_params": (),
        "required_body_fields": ("planId",),
        "success_status": 200,
        "response_fields": ("changed", "direction", "from", "to", "entitlement", "billing", "requestId"),
    },
    {
        "operation_id": "getV1Usage",
        "method": "GET",
        "path": "/v1/usage",
        "summary": "Your consumption and remaining allowance for this period",
        "auth": True,
        "auth_kind": "api_key",
        "path_params": (),
        "query_params": (),
        "required_body_fields": (),
        "success_status": 200,
        "response_fields": ("product", "tier", "status", "unit", "period", "included", "used", "ceiling", "remaining", "overageSoFarMinor", "spendCapMinor", "requestId"),
    },
)
# ---8<--- END GENERATED BY tools/gen-sdk.mjs ---8<---
