# l402-example-node

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A live reference app for [Native L402 integration](https://docs.lightningenable.com/products/l402-microtransactions/native-integration) on Node + Express.** Curl it from your terminal and watch a `402 Payment Required` come back with a real Lightning invoice. Then pay it and curl again — your second request gets through.

The whole integration is **3 lines of code**.

## Try the live demo

> Live URL: *(deploy your own — see below)*

```bash
# Health check — free, ungated
curl -i $URL/api/free/health

# Premium endpoint — 100 sats per request
curl -i $URL/api/premium/weather?city=miami

# Variable pricing — premium model costs 500 sats
curl -i $URL/api/premium/llm?prompt=hello&model=premium
```

## Run locally

```bash
git clone https://github.com/refined-element/l402-example-node
cd l402-example-node
npm install

cp .env.example .env
# edit .env, fill in LIGHTNING_ENABLE_API_KEY
# (generate one at https://api.lightningenable.com/dashboard/settings)

npm run dev
```

Then in another terminal:

```bash
curl -i http://localhost:3000/api/premium/weather
```

You should see something like:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
WWW-Authenticate: L402 macaroon="AgEL...", invoice="lnbc1u..."

{
  "error": "Payment Required",
  "l402": {
    "macaroon": "AgEL...",
    "invoice": "lnbc1u...",
    "amount_sats": 100,
    "payment_hash": "abc123...",
    "expires_at": "2026-05-12T01:00:00Z",
    "resource": "/api/premium/weather"
  }
}
```

Pay that Lightning invoice with any Lightning wallet (Phoenix, Muun, Zeus, Alby) to get a preimage, then retry:

```bash
curl -i http://localhost:3000/api/premium/weather \
  -H 'Authorization: L402 AgEL...:<your-preimage-hex>'
```

You'll get the real weather response.

## What's actually in the code

The whole L402 integration is one import and one `app.use()`:

```ts
// src/server.ts
import express from "express";
import { l402 } from "l402-express";          // ← 1. import

const app = express();

app.use(                                       // ← 2. mount the middleware
  "/api/premium",
  l402({
    apiKey: process.env.LIGHTNING_ENABLE_API_KEY!,
    priceSats: (req) => req.query.model === "premium" ? 500 : 100,
  }),
);

app.get("/api/premium/weather", (req, res) => {  // ← 3. your normal route
  res.json({ temp: 72, city: req.query.city ?? "Miami" });
});
```

The 30 lines around it are vanilla Express. The `l402-express` middleware handles:
- Reading the `Authorization: L402 ...` header
- Minting a Lightning invoice and macaroon via Lightning Enable's hosted API
- Sending `402 Payment Required` with the invoice
- Verifying the preimage when the client retries
- Stashing the verified credential on `res.locals.l402` for your handler to read

See [`src/server.ts`](./src/server.ts) for the whole file (under 100 lines).

## Demonstrates

- **Free + paid routes in the same app** — `/api/free/*` passes through; `/api/premium/*` is gated
- **Function-form variable pricing** — `priceSats: (req) => req.query.model === "premium" ? 500 : 100`
- **Two paid endpoints** — `/weather` and `/llm` (mock data; swap in your real provider)
- **`res.locals.l402` access** — handlers read the verified credential and echo it in the response

## Deploy your own

Two zero-config deploy options included:

### Render (free tier)

1. Fork this repo
2. Visit https://render.com/deploy and connect your fork
3. Render reads `render.yaml` and provisions a free web service
4. Set `LIGHTNING_ENABLE_API_KEY` in the Render dashboard env vars (don't commit it)
5. Done — your URL is `https://l402-example-node.onrender.com`

### fly.io

```bash
fly launch --copy-config --no-deploy
fly secrets set LIGHTNING_ENABLE_API_KEY=<your-key>
fly deploy
```

Both configs (`render.yaml`, `fly.toml`, `Dockerfile`) are in this repo.

## Modify and play

```bash
npm run dev   # tsx watch — auto-reload on save
```

Things to try:
- Add a new paid endpoint at `/api/premium/your-thing`
- Tweak the price function — by user (header), by time of day, by model
- Add a free `/api/free/manifest.json` exposing your endpoint catalog
- Wire up a real upstream API behind the L402 gate

## Production checklist

When you graduate from this example to your real API:

- [ ] Get `LIGHTNING_ENABLE_API_KEY` from your real merchant account, not a test key
- [ ] Verify your payment provider (Strike or OpenNode) is configured in the Lightning Enable dashboard
- [ ] Make sure your reverse proxy / load balancer forwards the `Authorization` header
- [ ] Add structured logging — `res.locals.l402` has `paymentHash`, `amountSats`, `resource` for usage analytics
- [ ] Decide if you want a custom `onInvalidToken` handler (e.g., to send fresh 402 instead of 401)

## Source code

- This app: https://github.com/refined-element/l402-example-node
- The middleware: https://github.com/refined-element/le-server-l402-express-node ([`l402-express` on npm](https://www.npmjs.com/package/l402-express))
- The SDK: https://github.com/refined-element/le-server-l402-node ([`l402-server` on npm](https://www.npmjs.com/package/l402-server))
- Lightning Enable docs: https://docs.lightningenable.com/products/l402-microtransactions/native-integration

## License

MIT
