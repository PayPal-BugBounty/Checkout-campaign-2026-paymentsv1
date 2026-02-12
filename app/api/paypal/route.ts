import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      clientSecret,
      environment,
      action,
      paymentId,
      saleId,
      authorizationId,
      orderId,
      captureId,
      refundId,
      payerId,
      requestBody,
      queryParams,
      patchBody,
      customBaseUrl,
    } = body;

    const baseUrl = customBaseUrl
      ? customBaseUrl.replace(/\/+$/, "")
      : environment === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    // Get access token
    const tokenStart = Date.now();
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    const tokenTime = Date.now() - tokenStart;

    if (!tokenRes.ok) {
      return NextResponse.json({
        success: false,
        error: "Authentication failed",
        tokenResponse: tokenData,
        httpRequest: {
          method: "POST",
          url: `${baseUrl}/v1/oauth2/token`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic <base64(clientId:clientSecret)>",
          },
          body: "grant_type=client_credentials",
        },
        httpResponse: {
          status: tokenRes.status,
          statusText: tokenRes.statusText,
          headers: Object.fromEntries(tokenRes.headers.entries()),
          body: tokenData,
          time: `${tokenTime}ms`,
        },
      });
    }

    const accessToken = tokenData.access_token;

    // Build the actual API request
    let url = "";
    let method = "GET";
    let apiBody: string | undefined = undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    switch (action) {
      case "create_payment":
        url = `${baseUrl}/v1/payments/payment`;
        method = "POST";
        apiBody = JSON.stringify(requestBody);
        break;

      case "list_payments": {
        const params = new URLSearchParams();
        if (queryParams?.count) params.set("count", queryParams.count);
        if (queryParams?.start_id) params.set("start_id", queryParams.start_id);
        if (queryParams?.start_index)
          params.set("start_index", queryParams.start_index);
        if (queryParams?.start_time)
          params.set("start_time", queryParams.start_time);
        if (queryParams?.end_time)
          params.set("end_time", queryParams.end_time);
        if (queryParams?.sort_by) params.set("sort_by", queryParams.sort_by);
        if (queryParams?.sort_order)
          params.set("sort_order", queryParams.sort_order);
        const qs = params.toString();
        url = `${baseUrl}/v1/payments/payment${qs ? "?" + qs : ""}`;
        method = "GET";
        break;
      }

      case "show_payment":
        url = `${baseUrl}/v1/payments/payment/${paymentId}`;
        method = "GET";
        break;

      case "update_payment":
        url = `${baseUrl}/v1/payments/payment/${paymentId}`;
        method = "PATCH";
        headers["Content-Type"] = "application/json";
        apiBody = JSON.stringify(patchBody);
        break;

      case "execute_payment":
        url = `${baseUrl}/v1/payments/payment/${paymentId}/execute`;
        method = "POST";
        apiBody = JSON.stringify(requestBody || { payer_id: payerId });
        break;

      case "show_sale":
        url = `${baseUrl}/v1/payments/sale/${saleId}`;
        method = "GET";
        break;

      case "refund_sale":
        url = `${baseUrl}/v1/payments/sale/${saleId}/refund`;
        method = "POST";
        apiBody = JSON.stringify(requestBody || {});
        break;

      case "show_authorization":
        url = `${baseUrl}/v1/payments/authorization/${authorizationId}`;
        method = "GET";
        break;

      case "capture_authorization":
        url = `${baseUrl}/v1/payments/authorization/${authorizationId}/capture`;
        method = "POST";
        apiBody = JSON.stringify(requestBody);
        break;

      case "void_authorization":
        url = `${baseUrl}/v1/payments/authorization/${authorizationId}/void`;
        method = "POST";
        apiBody = JSON.stringify({});
        break;

      case "reauthorize":
        url = `${baseUrl}/v1/payments/authorization/${authorizationId}/reauthorize`;
        method = "POST";
        apiBody = JSON.stringify(requestBody);
        break;

      case "show_order":
        url = `${baseUrl}/v1/payments/orders/${orderId}`;
        method = "GET";
        break;

      case "capture_order":
        url = `${baseUrl}/v1/payments/orders/${orderId}/capture`;
        method = "POST";
        apiBody = JSON.stringify(requestBody);
        break;

      case "void_order":
        url = `${baseUrl}/v1/payments/orders/${orderId}/do-void`;
        method = "POST";
        apiBody = JSON.stringify({});
        break;

      case "authorize_order":
        url = `${baseUrl}/v1/payments/orders/${orderId}/authorize`;
        method = "POST";
        apiBody = JSON.stringify(requestBody);
        break;

      case "show_capture":
        url = `${baseUrl}/v1/payments/capture/${captureId}`;
        method = "GET";
        break;

      case "refund_capture":
        url = `${baseUrl}/v1/payments/capture/${captureId}/refund`;
        method = "POST";
        apiBody = JSON.stringify(requestBody || {});
        break;

      case "show_refund":
        url = `${baseUrl}/v1/payments/refund/${refundId}`;
        method = "GET";
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const apiStart = Date.now();
    const fetchOpts: RequestInit = { method, headers };
    if (apiBody && method !== "GET") {
      fetchOpts.body = apiBody;
    }

    const apiRes = await fetch(url, fetchOpts);
    const apiTime = Date.now() - apiStart;

    let responseBody: unknown;
    const contentType = apiRes.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      responseBody = await apiRes.json();
    } else {
      responseBody = await apiRes.text();
    }

    // Build the curl command for easy reproduction
    let curlCmd = `curl -X ${method} '${url}'`;
    for (const [k, v] of Object.entries(headers)) {
      const displayVal =
        k === "Authorization" ? "Bearer <access_token>" : v;
      curlCmd += ` \\\n  -H '${k}: ${displayVal}'`;
    }
    if (apiBody && method !== "GET") {
      curlCmd += ` \\\n  -d '${apiBody}'`;
    }

    return NextResponse.json({
      success: apiRes.ok,
      httpRequest: {
        method,
        url,
        headers: {
          ...headers,
          Authorization: "Bearer <access_token>",
        },
        body: apiBody ? JSON.parse(apiBody) : undefined,
        curl: curlCmd,
      },
      httpResponse: {
        status: apiRes.status,
        statusText: apiRes.statusText,
        headers: Object.fromEntries(apiRes.headers.entries()),
        body: responseBody,
        time: `${apiTime}ms`,
      },
      tokenInfo: {
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        app_id: tokenData.app_id,
        expires_in: tokenData.expires_in,
        nonce: tokenData.nonce,
        authTime: `${tokenTime}ms`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
