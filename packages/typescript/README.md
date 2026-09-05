# Contract Entitlement API TypeScript SDK

Convert contracts and order forms into machine-readable entitlements, obligations, renewals, usage limits and commercial commitments.

This package is the zero-runtime-dependency TypeScript/JavaScript client from
the audited public integration repository. It supports ESM and CommonJS on
Node.js 18 or newer. Import and construction perform no network request.

## Install

```sh
npm install contract-entitlement
```

## Authenticated client

```ts
import { ContractEntitlement } from 'contract-entitlement'

const client = new ContractEntitlement({
  apiKey: process.env.CONTRACT_ENTITLEMENT_API_KEY,
})
```

Never place an API key in browser code, source control, logs, or examples.
Requesting a sandbox key is an email-verification and claim flow; it does not
return a key in the initial response.

- [Product, docs, demo, pricing, privacy, and terms](https://contractentitlement-api.com/?utm_source=npm&utm_medium=package&utm_campaign=contract-entitlement&utm_content=readme)
- [Source and changelog](https://github.com/API-Disk-Integrations/contract-entitlement)
- [Issues](https://github.com/API-Disk-Integrations/contract-entitlement/issues)

Security reports must not be filed in a public issue. Use the repository's
private security-reporting path after the owner confirms it is enabled.

MIT licensed. The API service remains governed by the product site's terms.
