import { getSharedDatabase } from "@pricelens/database";
import { createApiApp } from "./app.js";

export * from "./app.js";
export * from "./auth.js";
export * from "./openapi.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const db = getSharedDatabase();
    const { app } = createApiApp({ db });
    return app.fetch(request);
  },
};
