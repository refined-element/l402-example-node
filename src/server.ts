/**
 * l402-example-node — reference app for Native L402 integration on Node + Express.
 *
 * The whole L402 integration is the import on line 14 and the `app.use(l402(...))`
 * call on line 32. Everything else is plain Express.
 *
 * Run locally:
 *   cp .env.example .env  # then fill in LIGHTNING_ENABLE_API_KEY
 *   npm install
 *   npm run dev
 *
 * Then in another terminal:
 *   curl -i http://localhost:3000/api/free/health     # 200 OK, ungated
 *   curl -i http://localhost:3000/api/premium/weather # 402 Payment Required
 */

import express from "express";
import { l402 } from "l402-express";

const app = express();
const PORT = process.env.PORT ?? 3000;

// -----------------------------------------------------------------------------
// Free endpoint — not gated by L402. Useful as a health check.
// -----------------------------------------------------------------------------
app.get("/api/free/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// -----------------------------------------------------------------------------
// L402 gate — everything under /api/premium requires payment.
//
// `priceSats` accepts a function for variable pricing. Here we charge more
// for the "premium" model. Run `curl ...?model=premium` to see the 500-sat
// invoice; default is 100 sats.
// -----------------------------------------------------------------------------
app.use(
  "/api/premium",
  l402({
    apiKey: requireEnv("LIGHTNING_ENABLE_API_KEY"),
    priceSats: (req) => (req.query.model === "premium" ? 500 : 100),
    description: (req) =>
      req.path.includes("weather")
        ? "Premium weather forecast"
        : "Premium API access",
  }),
);

// -----------------------------------------------------------------------------
// Paid endpoints — only reachable with a valid L402 credential.
// -----------------------------------------------------------------------------
app.get("/api/premium/weather", (req, res) => {
  // Mock weather data. In a real app you'd hit a real weather provider here.
  const city = (req.query.city as string | undefined) ?? "Miami";
  res.json({
    city,
    temperature_f: 72 + Math.round(Math.random() * 20 - 10),
    conditions: ["sunny", "cloudy", "partly cloudy", "windy"][
      Math.floor(Math.random() * 4)
    ],
    timestamp: new Date().toISOString(),
    // The verified L402 credential is on res.locals.l402 — exposing it here
    // so curious callers can see what the middleware passes through.
    l402: res.locals.l402,
  });
});

app.get("/api/premium/llm", (req, res) => {
  const model = (req.query.model as string | undefined) ?? "standard";
  const prompt = (req.query.prompt as string | undefined) ?? "Hello, world.";
  res.json({
    model,
    prompt,
    completion: `[mock ${model} completion for: ${prompt}]`,
    tokens_used: 42,
    l402: res.locals.l402,
  });
});

// -----------------------------------------------------------------------------
// Root — explain what this is.
// -----------------------------------------------------------------------------
app.get("/", (_req, res) => {
  res.type("text").send(
    [
      "l402-example-node — reference app for Native L402 integration",
      "",
      "Endpoints:",
      "  GET /api/free/health           # free",
      "  GET /api/premium/weather       # 100 sats",
      "  GET /api/premium/weather?model=premium # 500 sats",
      "  GET /api/premium/llm?prompt=hi # 100 sats",
      "",
      "Source: https://github.com/refined-element/l402-example-node",
    ].join("\n"),
  );
});

app.listen(PORT, () => {
  console.log(`l402-example-node listening on http://localhost:${PORT}`);
  console.log("Try: curl -i http://localhost:" + PORT + "/api/premium/weather");
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    console.error(
      `Missing required env var: ${name}.\n` +
        `Copy .env.example to .env and fill it in. Generate a key at\n` +
        `https://api.lightningenable.com/dashboard/settings.`,
    );
    process.exit(1);
  }
  return value;
}
