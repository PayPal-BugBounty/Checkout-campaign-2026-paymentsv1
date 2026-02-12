"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

/* ─── Types ─── */
interface HttpInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  curl?: string;
}
interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  time: string;
}
interface ApiResult {
  success: boolean;
  error?: string;
  httpRequest?: HttpInfo;
  httpResponse?: HttpResponse;
  tokenInfo?: Record<string, unknown>;
  tokenResponse?: unknown;
}

type ActionType =
  | "create_payment"
  | "list_payments"
  | "show_payment"
  | "update_payment"
  | "execute_payment"
  | "show_sale"
  | "refund_sale"
  | "show_authorization"
  | "capture_authorization"
  | "void_authorization"
  | "reauthorize"
  | "show_order"
  | "capture_order"
  | "void_order"
  | "authorize_order"
  | "show_capture"
  | "refund_capture"
  | "show_refund";

/* ─── Action Metadata ─── */
const ACTIONS: {
  group: string;
  items: { key: ActionType; label: string; method: string }[];
}[] = [
  {
    group: "Payments",
    items: [
      { key: "create_payment", label: "Create Payment", method: "POST" },
      { key: "list_payments", label: "List Payments", method: "GET" },
      { key: "show_payment", label: "Show Payment Details", method: "GET" },
      { key: "update_payment", label: "Patch Payment", method: "PATCH" },
      { key: "execute_payment", label: "Execute Payment", method: "POST" },
    ],
  },
  {
    group: "Sales",
    items: [
      { key: "show_sale", label: "Show Sale Details", method: "GET" },
      { key: "refund_sale", label: "Refund Sale", method: "POST" },
    ],
  },
  {
    group: "Authorizations",
    items: [
      {
        key: "show_authorization",
        label: "Show Authorization",
        method: "GET",
      },
      {
        key: "capture_authorization",
        label: "Capture Authorization",
        method: "POST",
      },
      {
        key: "void_authorization",
        label: "Void Authorization",
        method: "POST",
      },
      { key: "reauthorize", label: "Re-authorize", method: "POST" },
    ],
  },
  {
    group: "Orders",
    items: [
      { key: "show_order", label: "Show Order Details", method: "GET" },
      { key: "capture_order", label: "Capture Order", method: "POST" },
      { key: "void_order", label: "Void Order", method: "POST" },
      { key: "authorize_order", label: "Authorize Order", method: "POST" },
    ],
  },
  {
    group: "Captures",
    items: [
      { key: "show_capture", label: "Show Capture Details", method: "GET" },
      { key: "refund_capture", label: "Refund Capture", method: "POST" },
    ],
  },
  {
    group: "Refunds",
    items: [
      { key: "show_refund", label: "Show Refund Details", method: "GET" },
    ],
  },
];

/* ─── Default Bodies ─── */
const DEFAULT_BODIES: Record<string, unknown> = {
  create_payment: {
    intent: "sale",
    payer: { payment_method: "paypal" },
    transactions: [
      {
        amount: {
          total: "10.00",
          currency: "USD",
          details: {
            subtotal: "10.00",
            tax: "0.00",
            shipping: "0.00",
          },
        },
        description: "Test payment via V1 API tester",
        item_list: {
          items: [
            {
              name: "Test Item",
              description: "A test item",
              quantity: "1",
              price: "10.00",
              currency: "USD",
            },
          ],
        },
      },
    ],
    redirect_urls: {
      return_url: "https://example.com/return",
      cancel_url: "https://example.com/cancel",
    },
  },
  execute_payment: { payer_id: "" },
  refund_sale: {},
  capture_authorization: {
    amount: { currency: "USD", total: "10.00" },
    is_final_capture: true,
  },
  reauthorize: { amount: { total: "10.00", currency: "USD" } },
  capture_order: {
    amount: { currency: "USD", total: "10.00" },
    is_final_capture: true,
  },
  authorize_order: { amount: { currency: "USD", total: "10.00" } },
  refund_capture: {},
  update_payment: [
    {
      op: "replace",
      path: "/transactions/0/amount",
      value: {
        total: "20.00",
        currency: "USD",
        details: { subtotal: "20.00", tax: "0.00", shipping: "0.00" },
      },
    },
  ],
};

/* ─── METHOD BADGE COLORS ─── */
const METHOD_COLORS: Record<string, string> = {
  GET: "#22c55e",
  POST: "#f59e0b",
  PATCH: "#a78bfa",
  DELETE: "#ef4444",
  PUT: "#3b82f6",
};

/* ─── MAIN COMPONENT ─── */
export default function PayPalV1Tester() {
  // Credentials
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "live">(
    "sandbox"
  );
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [showCreds, setShowCreds] = useState(true);

  // Action state
  const [activeAction, setActiveAction] = useState<ActionType>("create_payment");
  const [loading, setLoading] = useState(false);

  // Resource IDs
  const [paymentId, setPaymentId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [authorizationId, setAuthorizationId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [captureId, setCaptureId] = useState("");
  const [refundId, setRefundId] = useState("");
  const [payerId, setPayerId] = useState("");

  // List payments query params
  const [listCount, setListCount] = useState("10");
  const [listStartId, setListStartId] = useState("");
  const [listStartTime, setListStartTime] = useState("");
  const [listEndTime, setListEndTime] = useState("");

  // Request body editor
  const [bodyText, setBodyText] = useState(
    JSON.stringify(DEFAULT_BODIES.create_payment, null, 2)
  );

  // Results
  const [result, setResult] = useState<ApiResult | null>(null);
  const [history, setHistory] = useState<
    { action: string; time: string; success: boolean; summary: string }[]
  >([]);

  // Bottom panel tab
  const [bottomTab, setBottomTab] = useState<
    "request" | "response" | "curl" | "token"
  >("response");

  // Sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  // Update body text when action changes
  useEffect(() => {
    if (DEFAULT_BODIES[activeAction]) {
      setBodyText(JSON.stringify(DEFAULT_BODIES[activeAction], null, 2));
    } else {
      setBodyText("");
    }
  }, [activeAction]);

  /* ─── API Call ─── */
  const executeAction = useCallback(async () => {
    if (!clientId || !clientSecret) {
      alert("Enter Client ID and Secret first.");
      return;
    }
    setLoading(true);
    setResult(null);

    let parsedBody: unknown = undefined;
    let parsedPatch: unknown = undefined;
    const needsBody = [
      "create_payment",
      "execute_payment",
      "refund_sale",
      "capture_authorization",
      "reauthorize",
      "capture_order",
      "authorize_order",
      "refund_capture",
    ].includes(activeAction);
    const isPatch = activeAction === "update_payment";

    if (needsBody && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        alert("Invalid JSON in request body");
        setLoading(false);
        return;
      }
    }
    if (isPatch && bodyText.trim()) {
      try {
        parsedPatch = JSON.parse(bodyText);
      } catch {
        alert("Invalid JSON in patch body");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret,
          environment,
          customBaseUrl: customBaseUrl || undefined,
          action: activeAction,
          paymentId,
          saleId,
          authorizationId,
          orderId,
          captureId,
          refundId,
          payerId,
          requestBody: parsedBody,
          patchBody: parsedPatch,
          queryParams:
            activeAction === "list_payments"
              ? {
                  count: listCount || undefined,
                  start_id: listStartId || undefined,
                  start_time: listStartTime || undefined,
                  end_time: listEndTime || undefined,
                }
              : undefined,
        }),
      });
      const data: ApiResult = await res.json();
      setResult(data);
      setBottomTab("response");

      // Auto-extract IDs from response
      const respBody = data.httpResponse?.body as Record<string, unknown>;
      if (respBody) {
        if (respBody.id && typeof respBody.id === "string") {
          const id = respBody.id as string;
          if (id.startsWith("PAY-") || id.startsWith("PAYID-")) {
            setPaymentId(id);
          }
        }
        // Extract from related_resources
        const txns = respBody.transactions as Array<{
          related_resources?: Array<Record<string, { id: string }>>;
        }>;
        if (Array.isArray(txns)) {
          for (const txn of txns) {
            if (Array.isArray(txn.related_resources)) {
              for (const rr of txn.related_resources) {
                if (rr.sale?.id) setSaleId(rr.sale.id);
                if (rr.authorization?.id) setAuthorizationId(rr.authorization.id);
                if (rr.order?.id) setOrderId(rr.order.id);
                if (rr.capture?.id) setCaptureId(rr.capture.id);
              }
            }
          }
        }
      }

      // Add to history
      const now = new Date().toLocaleTimeString();
      const summary = data.httpResponse
        ? `${data.httpResponse.status} ${data.httpResponse.statusText} (${data.httpResponse.time})`
        : data.error || "Unknown";
      setHistory((prev) => [
        { action: activeAction, time: now, success: data.success, summary },
        ...prev.slice(0, 49),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ success: false, error: msg });
    } finally {
      setLoading(false);
    }
  }, [
    clientId,
    clientSecret,
    environment,
    customBaseUrl,
    activeAction,
    paymentId,
    saleId,
    authorizationId,
    orderId,
    captureId,
    refundId,
    payerId,
    bodyText,
    listCount,
    listStartId,
    listStartTime,
    listEndTime,
  ]);

  /* ─── Which fields to show ─── */
  const needsPaymentId = [
    "show_payment",
    "update_payment",
    "execute_payment",
  ].includes(activeAction);
  const needsSaleId = ["show_sale", "refund_sale"].includes(activeAction);
  const needsAuthId = [
    "show_authorization",
    "capture_authorization",
    "void_authorization",
    "reauthorize",
  ].includes(activeAction);
  const needsOrderId = [
    "show_order",
    "capture_order",
    "void_order",
    "authorize_order",
  ].includes(activeAction);
  const needsCaptureId = ["show_capture", "refund_capture"].includes(
    activeAction
  );
  const needsRefundId = activeAction === "show_refund";
  const needsPayerId = activeAction === "execute_payment";
  const needsBody = [
    "create_payment",
    "execute_payment",
    "update_payment",
    "refund_sale",
    "capture_authorization",
    "reauthorize",
    "capture_order",
    "authorize_order",
    "refund_capture",
  ].includes(activeAction);
  const isListPayments = activeAction === "list_payments";

  const activeLabel =
    ACTIONS.flatMap((g) => g.items).find((i) => i.key === activeAction)
      ?.label || activeAction;
  const activeMethod =
    ACTIONS.flatMap((g) => g.items).find((i) => i.key === activeAction)
      ?.method || "GET";

  return (
    <div style={styles.root}>
      {/* ─── TOP BAR ─── */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.logo}>◈</span>
          <span style={styles.title}>PayPal V1 Payments Tester</span>
          <span style={styles.badge}>DEPRECATED API</span>
        </div>
        <div style={styles.topBarRight}>
          <button
            style={styles.credsToggle}
            onClick={() => setShowCreds(!showCreds)}
          >
            {showCreds ? "▾ Hide Credentials" : "▸ Show Credentials"}
          </button>
          <span
            style={{
              ...styles.envBadge,
              background: environment === "live" ? "#dc2626" : "#059669",
            }}
          >
            {environment === "live" ? "LIVE" : "SANDBOX"}
          </span>
        </div>
      </header>

      {/* ─── CREDENTIALS BAR ─── */}
      {showCreds && (
        <div style={styles.credsBar}>
          <div style={styles.credsGrid}>
            <div style={styles.credField}>
              <label style={styles.credLabel}>Client ID</label>
              <input
                style={styles.credInput}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter client ID..."
                spellCheck={false}
              />
            </div>
            <div style={styles.credField}>
              <label style={styles.credLabel}>Client Secret</label>
              <input
                style={styles.credInput}
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter client secret..."
                spellCheck={false}
              />
            </div>
            <div style={styles.credField}>
              <label style={styles.credLabel}>Environment</label>
              <select
                style={styles.credSelect}
                value={environment}
                onChange={(e) =>
                  setEnvironment(e.target.value as "sandbox" | "live")
                }
              >
                <option value="sandbox">Sandbox</option>
                <option value="live">Live / Production</option>
              </select>
            </div>
            <div style={styles.credField}>
              <label style={styles.credLabel}>
                Custom Base URL{" "}
                <span style={{ opacity: 0.5, fontWeight: 400 }}>
                  (optional)
                </span>
              </label>
              <input
                style={styles.credInput}
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="e.g. https://api-m.msmaster.qa.paypal.com"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN BODY ─── */}
      <div style={styles.mainBody}>
        {/* ─── SIDEBAR ─── */}
        <aside
          style={{
            ...styles.sidebar,
            width: sidebarCollapsed ? 48 : 240,
            minWidth: sidebarCollapsed ? 48 : 240,
          }}
        >
          <button
            style={styles.sidebarToggle}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>
          {!sidebarCollapsed &&
            ACTIONS.map((group) => (
              <div key={group.group} style={styles.sidebarGroup}>
                <div style={styles.sidebarGroupTitle}>{group.group}</div>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    style={{
                      ...styles.sidebarItem,
                      ...(activeAction === item.key
                        ? styles.sidebarItemActive
                        : {}),
                    }}
                    onClick={() => setActiveAction(item.key)}
                  >
                    <span
                      style={{
                        ...styles.methodTag,
                        color: METHOD_COLORS[item.method] || "#888",
                      }}
                    >
                      {item.method}
                    </span>
                    <span style={styles.sidebarItemLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
        </aside>

        {/* ─── CONTENT ─── */}
        <main style={styles.content}>
          {/* ACTION HEADER */}
          <div style={styles.actionHeader}>
            <span
              style={{
                ...styles.actionMethod,
                background: METHOD_COLORS[activeMethod] || "#888",
              }}
            >
              {activeMethod}
            </span>
            <span style={styles.actionLabel}>{activeLabel}</span>
            <button
              style={{
                ...styles.executeBtn,
                opacity: loading ? 0.6 : 1,
              }}
              onClick={executeAction}
              disabled={loading}
            >
              {loading ? "⏳ Executing..." : "▶ Execute"}
            </button>
          </div>

          {/* FORM AREA */}
          <div style={styles.formArea}>
            {/* Resource ID fields */}
            <div style={styles.fieldsRow}>
              {needsPaymentId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Payment ID</label>
                  <input
                    style={styles.fieldInput}
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value)}
                    placeholder="PAY-XXXXX..."
                    spellCheck={false}
                  />
                </div>
              )}
              {needsSaleId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Sale ID</label>
                  <input
                    style={styles.fieldInput}
                    value={saleId}
                    onChange={(e) => setSaleId(e.target.value)}
                    placeholder="Enter sale ID..."
                    spellCheck={false}
                  />
                </div>
              )}
              {needsAuthId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Authorization ID</label>
                  <input
                    style={styles.fieldInput}
                    value={authorizationId}
                    onChange={(e) => setAuthorizationId(e.target.value)}
                    placeholder="Enter authorization ID..."
                    spellCheck={false}
                  />
                </div>
              )}
              {needsOrderId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Order ID</label>
                  <input
                    style={styles.fieldInput}
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="O-XXXXX..."
                    spellCheck={false}
                  />
                </div>
              )}
              {needsCaptureId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Capture ID</label>
                  <input
                    style={styles.fieldInput}
                    value={captureId}
                    onChange={(e) => setCaptureId(e.target.value)}
                    placeholder="Enter capture ID..."
                    spellCheck={false}
                  />
                </div>
              )}
              {needsRefundId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Refund ID</label>
                  <input
                    style={styles.fieldInput}
                    value={refundId}
                    onChange={(e) => setRefundId(e.target.value)}
                    placeholder="Enter refund ID..."
                    spellCheck={false}
                  />
                </div>
              )}
              {needsPayerId && (
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Payer ID</label>
                  <input
                    style={styles.fieldInput}
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    placeholder="From return URL params..."
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {/* List payments query params */}
            {isListPayments && (
              <div style={styles.fieldsRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Count (max 20)</label>
                  <input
                    style={styles.fieldInput}
                    value={listCount}
                    onChange={(e) => setListCount(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Start ID</label>
                  <input
                    style={styles.fieldInput}
                    value={listStartId}
                    onChange={(e) => setListStartId(e.target.value)}
                    placeholder="PAY-XXX (optional)"
                    spellCheck={false}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Start Time</label>
                  <input
                    style={styles.fieldInput}
                    value={listStartTime}
                    onChange={(e) => setListStartTime(e.target.value)}
                    placeholder="2024-01-01T00:00:00Z"
                    spellCheck={false}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>End Time</label>
                  <input
                    style={styles.fieldInput}
                    value={listEndTime}
                    onChange={(e) => setListEndTime(e.target.value)}
                    placeholder="2024-12-31T23:59:59Z"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

            {/* Body editor */}
            {needsBody && (
              <div style={styles.bodyEditor}>
                <label style={styles.fieldLabel}>Request Body (JSON)</label>
                <textarea
                  style={styles.bodyTextarea}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* ─── EXTRACTED IDS ─── */}
          <div style={styles.idsBar}>
            <span style={styles.idsBarTitle}>Tracked IDs:</span>
            {paymentId && (
              <span style={styles.idChip}>
                PAY: <code>{paymentId.slice(0, 20)}...</code>
              </span>
            )}
            {saleId && (
              <span style={styles.idChip}>
                SALE: <code>{saleId}</code>
              </span>
            )}
            {authorizationId && (
              <span style={styles.idChip}>
                AUTH: <code>{authorizationId}</code>
              </span>
            )}
            {orderId && (
              <span style={styles.idChip}>
                ORDER: <code>{orderId}</code>
              </span>
            )}
            {captureId && (
              <span style={styles.idChip}>
                CAP: <code>{captureId}</code>
              </span>
            )}
            {refundId && (
              <span style={styles.idChip}>
                REF: <code>{refundId}</code>
              </span>
            )}
            {!paymentId &&
              !saleId &&
              !authorizationId &&
              !orderId &&
              !captureId &&
              !refundId && (
                <span style={{ opacity: 0.4, fontSize: 12 }}>
                  IDs auto-populate from responses
                </span>
              )}
          </div>

          {/* ─── RESULTS PANEL ─── */}
          <div style={styles.resultsPanel} ref={resultRef}>
            {/* Tabs */}
            <div style={styles.resultTabs}>
              {(["response", "request", "curl", "token"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    style={{
                      ...styles.resultTab,
                      ...(bottomTab === tab ? styles.resultTabActive : {}),
                    }}
                    onClick={() => setBottomTab(tab)}
                  >
                    {tab === "response"
                      ? "Response"
                      : tab === "request"
                        ? "Request"
                        : tab === "curl"
                          ? "cURL"
                          : "Token Info"}
                    {tab === "response" && result?.httpResponse && (
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: result.success ? "#059669" : "#dc2626",
                        }}
                      >
                        {result.httpResponse.status}
                      </span>
                    )}
                  </button>
                )
              )}
              {result?.httpResponse && (
                <span style={styles.responseTime}>
                  {result.httpResponse.time}
                </span>
              )}
            </div>

            {/* Tab content */}
            <div style={styles.resultContent}>
              {!result && !loading && (
                <div style={styles.emptyState}>
                  Select an action and click Execute to see results here.
                </div>
              )}
              {loading && (
                <div style={styles.emptyState}>
                  <span style={styles.spinner}>⟳</span> Executing...
                </div>
              )}
              {result && bottomTab === "response" && (
                <pre style={styles.jsonPre}>
                  {result.error && !result.httpResponse
                    ? `Error: ${result.error}`
                    : JSON.stringify(result.httpResponse?.body, null, 2)}
                </pre>
              )}
              {result && bottomTab === "request" && result.httpRequest && (
                <pre style={styles.jsonPre}>
                  {`${result.httpRequest.method} ${result.httpRequest.url}\n\n` +
                    `── Headers ──\n${JSON.stringify(result.httpRequest.headers, null, 2)}\n\n` +
                    (result.httpRequest.body
                      ? `── Body ──\n${JSON.stringify(result.httpRequest.body, null, 2)}`
                      : "── No Body ──")}
                </pre>
              )}
              {result && bottomTab === "curl" && result.httpRequest?.curl && (
                <div>
                  <button
                    style={styles.copyBtn}
                    onClick={() => {
                      navigator.clipboard.writeText(
                        result.httpRequest?.curl || ""
                      );
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  <pre style={styles.jsonPre}>{result.httpRequest.curl}</pre>
                </div>
              )}
              {result && bottomTab === "token" && (
                <pre style={styles.jsonPre}>
                  {result.tokenInfo
                    ? JSON.stringify(result.tokenInfo, null, 2)
                    : result.tokenResponse
                      ? `Auth failed:\n${JSON.stringify(result.tokenResponse, null, 2)}`
                      : "No token info available"}
                </pre>
              )}
            </div>

            {/* Response headers */}
            {result?.httpResponse && bottomTab === "response" && (
              <details style={styles.headersDetails}>
                <summary style={styles.headersSummary}>
                  Response Headers
                </summary>
                <pre style={styles.headersPre}>
                  {JSON.stringify(result.httpResponse.headers, null, 2)}
                </pre>
              </details>
            )}
          </div>

          {/* ─── HISTORY ─── */}
          {history.length > 0 && (
            <div style={styles.historyPanel}>
              <div style={styles.historyTitle}>
                Request History
                <button
                  style={styles.clearHistBtn}
                  onClick={() => setHistory([])}
                >
                  Clear
                </button>
              </div>
              <div style={styles.historyList}>
                {history.map((h, i) => (
                  <div key={i} style={styles.historyItem}>
                    <span
                      style={{
                        ...styles.historyDot,
                        background: h.success ? "#22c55e" : "#ef4444",
                      }}
                    />
                    <span style={styles.historyTime}>{h.time}</span>
                    <span style={styles.historyAction}>{h.action}</span>
                    <span style={styles.historySummary}>{h.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── STYLES ─── */
const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'DM Sans', sans-serif",
    background: "#0c0e14",
    color: "#e0e4ef",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "#12151e",
    borderBottom: "1px solid #1e2233",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    fontSize: 22,
    color: "#f59e0b",
    fontWeight: 700,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#f0f2f8",
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "3px 8px",
    borderRadius: 4,
    background: "#dc262620",
    color: "#fca5a5",
    border: "1px solid #dc262640",
  },
  topBarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  credsToggle: {
    background: "transparent",
    border: "1px solid #2a2f42",
    color: "#9ca3af",
    fontSize: 12,
    padding: "5px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  envBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "4px 10px",
    borderRadius: 4,
    color: "#fff",
  },
  credsBar: {
    background: "#111420",
    borderBottom: "1px solid #1e2233",
    padding: "14px 20px",
  },
  credsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  credField: { display: "flex", flexDirection: "column", gap: 4 },
  credLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  credInput: {
    background: "#0c0e14",
    border: "1px solid #2a2f42",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    color: "#e0e4ef",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
  },
  credSelect: {
    background: "#0c0e14",
    border: "1px solid #2a2f42",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    color: "#e0e4ef",
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  },
  mainBody: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    background: "#111420",
    borderRight: "1px solid #1e2233",
    overflowY: "auto" as const,
    transition: "width 0.2s, min-width 0.2s",
    flexShrink: 0,
    position: "relative" as const,
  },
  sidebarToggle: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    background: "transparent",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 6px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  sidebarGroup: {
    padding: "12px 0 4px",
  },
  sidebarGroupTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#4b5563",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "0 16px 6px",
  },
  sidebarItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "7px 16px",
    background: "transparent",
    border: "none",
    color: "#9ca3af",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "'DM Sans', sans-serif",
    transition: "background 0.1s, color 0.1s",
  },
  sidebarItemActive: {
    background: "#1a1f30",
    color: "#f0f2f8",
    borderLeft: "2px solid #f59e0b",
  },
  sidebarItemLabel: { flex: 1 },
  methodTag: {
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.04em",
    width: 40,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  actionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  actionMethod: {
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 4,
    color: "#000",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.04em",
  },
  actionLabel: {
    fontSize: 18,
    fontWeight: 700,
    color: "#f0f2f8",
    flex: 1,
  },
  executeBtn: {
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    border: "none",
    color: "#000",
    fontSize: 13,
    fontWeight: 700,
    padding: "9px 24px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.02em",
  },
  formArea: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  fieldsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: "1 1 200px",
    minWidth: 200,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  fieldInput: {
    background: "#0c0e14",
    border: "1px solid #2a2f42",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    color: "#e0e4ef",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
  },
  bodyEditor: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  bodyTextarea: {
    background: "#0a0c12",
    border: "1px solid #2a2f42",
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    color: "#e0e4ef",
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
    minHeight: 200,
    resize: "vertical" as const,
    lineHeight: 1.5,
  },
  idsBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#111420",
    borderRadius: 8,
    flexWrap: "wrap" as const,
    border: "1px solid #1e2233",
  },
  idsBarTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#4b5563",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  idChip: {
    fontSize: 11,
    background: "#1a1f30",
    padding: "3px 8px",
    borderRadius: 4,
    color: "#9ca3af",
    fontFamily: "'JetBrains Mono', monospace",
    border: "1px solid #2a2f42",
  },
  resultsPanel: {
    background: "#111420",
    border: "1px solid #1e2233",
    borderRadius: 10,
    overflow: "hidden",
    flex: 1,
    minHeight: 300,
    display: "flex",
    flexDirection: "column",
  },
  resultTabs: {
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid #1e2233",
    background: "#0f1119",
    padding: "0 8px",
  },
  resultTab: {
    background: "transparent",
    border: "none",
    color: "#6b7280",
    fontSize: 12,
    fontWeight: 600,
    padding: "10px 14px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    borderBottom: "2px solid transparent",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "color 0.1s",
  },
  resultTabActive: {
    color: "#f0f2f8",
    borderBottom: "2px solid #f59e0b",
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 3,
    color: "#fff",
  },
  responseTime: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#4b5563",
    fontFamily: "'JetBrains Mono', monospace",
  },
  resultContent: {
    flex: 1,
    overflow: "auto",
    padding: 0,
  },
  emptyState: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: 200,
    color: "#4b5563",
    fontSize: 13,
    gap: 8,
  },
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
    fontSize: 18,
  },
  jsonPre: {
    margin: 0,
    padding: 16,
    fontSize: 12,
    lineHeight: 1.6,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#c9d1e0",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    overflow: "auto",
  },
  copyBtn: {
    margin: "8px 16px 0",
    background: "#1a1f30",
    border: "1px solid #2a2f42",
    color: "#9ca3af",
    fontSize: 11,
    padding: "5px 12px",
    borderRadius: 5,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  headersDetails: {
    borderTop: "1px solid #1e2233",
    padding: "8px 16px",
  },
  headersSummary: {
    fontSize: 11,
    color: "#6b7280",
    cursor: "pointer",
    fontWeight: 600,
  },
  headersPre: {
    margin: "8px 0 0",
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#6b7280",
    whiteSpace: "pre-wrap" as const,
  },
  historyPanel: {
    background: "#111420",
    border: "1px solid #1e2233",
    borderRadius: 10,
    overflow: "hidden",
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    padding: "10px 14px",
    borderBottom: "1px solid #1e2233",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearHistBtn: {
    background: "transparent",
    border: "1px solid #2a2f42",
    color: "#6b7280",
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  historyList: {
    maxHeight: 200,
    overflow: "auto",
  },
  historyItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    fontSize: 11,
    borderBottom: "1px solid #1a1f2e",
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  },
  historyTime: {
    color: "#4b5563",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    width: 70,
    flexShrink: 0,
  },
  historyAction: {
    color: "#9ca3af",
    fontWeight: 600,
    width: 160,
    flexShrink: 0,
  },
  historySummary: {
    color: "#6b7280",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
  },
};
