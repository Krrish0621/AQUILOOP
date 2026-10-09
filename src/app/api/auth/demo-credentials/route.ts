import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

function resolveDemoPasswordFromFile(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        if (key === "AQUILOOP_DEMO_PASSWORD") {
          const val = line
            .slice(eqIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (val) return val;
        }
      }
    }
  } catch {
    // Ignore file read errors
  }
  return "";
}

function resolveDemoPassword(): string {
  const fromEnv = process.env.AQUILOOP_DEMO_PASSWORD?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return (
    resolveDemoPasswordFromFile(".env.local") ||
    resolveDemoPasswordFromFile(".env.production") ||
    resolveDemoPasswordFromFile(".env")
  );
}

/**
 * GET /api/auth/demo-credentials
 *
 * Returns the shared disposable demo password strictly for the four `.test`
 * hackathon demo accounts (`operator.demo@aquiloop.test`, `worker.demo@aquiloop.test`,
 * `farmer.demo@aquiloop.test`, `buyer.demo@aquiloop.test`).
 */
export async function GET() {
  const password = resolveDemoPassword();

  return NextResponse.json(
    {
      available: Boolean(password),
      password,
      accounts: {
        OPERATOR: "operator.demo@aquiloop.test",
        WORKER: "worker.demo@aquiloop.test",
        FARMER: "farmer.demo@aquiloop.test",
        BUYER: "buyer.demo@aquiloop.test",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
