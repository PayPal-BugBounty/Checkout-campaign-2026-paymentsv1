# PayPal V1 Payments API Tester

Interactive web application for testing the PayPal Payments V1 REST API (`/v1/payments`).

## Features

- **All V1 endpoints**: Create, list, show, update, execute payments; sale details & refunds; authorization capture/void/reauthorize; order capture/void/authorize; capture refund; refund details
- **Custom credentials**: Enter your own Client ID and Secret per request
- **Environment switching**: Sandbox, Live, or custom base URL
- **Full HTTP inspection**: See the exact request (method, URL, headers, body) and response for every call
- **cURL export**: Copy the equivalent cURL command for any request
- **Auto ID tracking**: Resource IDs (payment, sale, authorization, order, capture) are auto-extracted from responses
- **Request history**: Track all API calls made during your session

## Deploy on Vercel

```bash
npm install
npm run build
```

Push to GitHub and import in [Vercel](https://vercel.com) — zero configuration needed.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Next.js 14** with App Router
- **API Route** (`/api/paypal`) proxies all calls to PayPal, returns structured request/response data
- Credentials are sent per-request, never stored server-side
- No external dependencies beyond Next.js + React

## Note

The `/v1/payments` API is deprecated by PayPal. Use `/v2/payments` or `/v2/checkout/orders` for new integrations. This tool is for testing and security research on the legacy API.
