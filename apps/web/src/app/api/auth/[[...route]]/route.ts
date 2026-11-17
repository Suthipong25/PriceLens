import { getServerApiApp } from "@/lib/server-api";

export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  const { app } = await getServerApiApp();
  return app.fetch(request);
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
