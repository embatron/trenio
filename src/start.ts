import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logCaught, wasLogged } from "./lib/log/logger";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const response = await next();
    if (response instanceof Response && !response.headers.has("x-request-id")) {
      try {
        response.headers.set("x-request-id", crypto.randomUUID());
      } catch {
        /* a locked response still reaches the client */
      }
    }
    return response;
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (!wasLogged(error)) logCaught("system", "system.unhandled", error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
