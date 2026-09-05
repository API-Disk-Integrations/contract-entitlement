# Contract Entitlement API

Convert contracts and order forms into machine-readable entitlements, obligations, renewals, usage limits and commercial commitments.

- [Product and pricing](https://contractentitlement-api.com/?utm_source=github&utm_medium=developer&utm_campaign=contract-entitlement-github&utm_content=readme#pricing)
- [Developer documentation](https://contractentitlement-api.com/docs?utm_source=github&utm_medium=developer&utm_campaign=contract-entitlement-github&utm_content=readme)
- [Create a free account](https://contractentitlement-api.com/signup?utm_source=github&utm_medium=developer&utm_campaign=contract-entitlement-github&utm_content=readme)
- [OpenAPI contract](https://contractentitlement-api.com/openapi.json)
- [Postman collection](./postman_collection.json)

## Quickstart

### 1. Request a free-key verification email

```bash
curl -X POST https://contractentitlement-api.com/v1/keys \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","source":{"source":"github","medium":"developer","campaign":"contract-entitlement-github","content":"readme"}}'
```

The service returns `202 Accepted` and sends a one-time claim link. Follow the
email, or exchange its token with `POST /v1/keys/claim`. The API key is shown
once after verification; store it securely. No card is required for the free
sandbox. Current free allowance: **25 contracts/month**.

### 2. Make the first product call

```bash
curl -X POST https://contractentitlement-api.com/v1/contracts \
  -H "Authorization: Bearer $KEY" \
  -H 'content-type: application/json' \
  -d '{"contract":{
        "contractId":"ORD-2026-0041","customer":"Acme Corp",
        "supplier":"Northwind Software","currency":"USD",
        "startsAt":"2026-01-01","endsAt":"2026-12-31",
        "lineItems":[{"sku":"platform.enterprise","quantity":250,
                      "unitPriceMinor":4000,"frequency":"monthly"}],
        "renewal":{"autoRenew":true,"noticeDays":90,
                   "termMonths":12,"upliftCapPct":5}}}'
```

## SDKs

The repository includes dependency-light client files that point to the current
contract and canonical product domain:

- [Python SDK](./sdk/python/contract_entitlement.py) — reads `CONTRACT_ENTITLEMENT_API_KEY`
- [TypeScript SDK](./sdk/typescript/index.ts)

Copy the file you need into your project. The OpenAPI document remains the
authoritative operation and schema contract.

## Authentication and errors

API operations use `Authorization: Bearer <API_KEY>` (or `x-api-key` where
documented). Dashboard-session operations and signed service webhooks are not
callable with a customer API key. Public demo and health operations require no
credential. Errors use a stable `error.code` plus a request ID for support.

## Distribution attribution

The key request above identifies this README with the stable tuple
`github / developer / contract-entitlement-github / readme`. The Postman collection and both
SDKs carry their own source metadata. Attribution is used to compare qualified
activation and retained use; it is not evidence that this channel already
performs.

## License

[MIT](./LICENSE)
