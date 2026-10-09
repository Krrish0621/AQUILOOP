import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { SignatureV4 } from "@smithy/signature-v4";
import type { HttpRequest } from "@smithy/types";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import bundledOutputs from "../../../../../amplify_outputs.json";

const PUBLIC_SELF_ASSIGNABLE_ROLES = ["WORKER", "FARMER", "BUYER"] as const;
const ALL_AQUILOOP_ROLES = ["OPERATOR", "WORKER", "FARMER", "BUYER"] as const;

type PublicRole = (typeof PUBLIC_SELF_ASSIGNABLE_ROLES)[number];

function toBuffer(data: string | ArrayBuffer | ArrayBufferView): Buffer {
  if (typeof data === "string") return Buffer.from(data, "utf8");
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return Buffer.from(data);
}

class Sha256Hash {
  private hash: crypto.Hash | crypto.Hmac;

  constructor(secret?: string | ArrayBuffer | ArrayBufferView) {
    this.hash = secret
      ? crypto.createHmac("sha256", toBuffer(secret))
      : crypto.createHash("sha256");
  }

  update(data: Uint8Array | string): void {
    this.hash.update(typeof data === "string" ? Buffer.from(data, "utf8") : data);
  }

  async digest(): Promise<Uint8Array> {
    return new Uint8Array(this.hash.digest());
  }
}

interface AmplifyAuthOutputs {
  auth?: {
    user_pool_id?: string;
    aws_region?: string;
    groups?: Record<string, { precedence?: number }>[];
  };
}

function readAmplifyAuthConfig(): { userPoolId: string; region: string } | null {
  const fromBundled = bundledOutputs as unknown as
    | AmplifyAuthOutputs
    | undefined;
  if (fromBundled?.auth?.user_pool_id && fromBundled?.auth?.aws_region) {
    return {
      userPoolId: fromBundled.auth.user_pool_id,
      region: fromBundled.auth.aws_region,
    };
  }
  try {
    const filePath = path.join(process.cwd(), "amplify_outputs.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as AmplifyAuthOutputs;
    const userPoolId = parsed.auth?.user_pool_id;
    const region = parsed.auth?.aws_region;
    if (!userPoolId || !region) return null;
    return { userPoolId, region };
  } catch {
    return null;
  }
}

async function callCognitoAdminApi(
  region: string,
  targetAction: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const hostname = `cognito-idp.${region}.amazonaws.com`;
  const body = JSON.stringify(payload);

  const request: HttpRequest = {
    method: "POST",
    protocol: "https:",
    hostname,
    path: "/",
    headers: {
      host: hostname,
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${targetAction}`,
    },
    body,
  };

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: "cognito-idp",
    sha256: Sha256Hash,
  });

  const signed = await signer.sign(request);

  const response = await fetch(`https://${hostname}/`, {
    method: "POST",
    headers: signed.headers,
    body,
    cache: "no-store",
  });


  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const errMsg =
      (data.message as string) ||
      (data.__type as string) ||
      `Cognito Admin API error (${response.status})`;
    throw new Error(errMsg);
  }

  return data;
}

/**
 * POST /api/auth/assign-role
 *
 * Securely assigns a newly registered user to their selected non-privileged
 * Cognito User Pool group (`WORKER`, `FARMER`, or `BUYER`) upon initial sign-in.
 *
 * Security invariants:
 * 1. NEVER allows self-assigning `OPERATOR` (`403 Forbidden`).
 * 2. Cryptographically validates the user's Cognito AccessToken via `GetUser`.
 * 3. Never overwrites an existing Cognito group membership (`AdminListGroupsForUser`).
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing Cognito Bearer access token." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice("Bearer ".length).trim();
    if (!accessToken) {
      return NextResponse.json(
        { error: "Empty Cognito access token." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      role?: string;
    };
    const requestedRole = body.role?.toUpperCase();

    if (requestedRole === "OPERATOR") {
      return NextResponse.json(
        {
          error:
            "OPERATOR is a privileged municipal role and cannot be self-assigned. Operator access must be granted via the OPERATOR group in Amazon Cognito.",
        },
        { status: 403 }
      );
    }

    if (
      !requestedRole ||
      !PUBLIC_SELF_ASSIGNABLE_ROLES.includes(requestedRole as PublicRole)
    ) {
      return NextResponse.json(
        {
          error: "Invalid role selection. Allowed public roles: WORKER, FARMER, BUYER.",
        },
        { status: 400 }
      );
    }

    const config = readAmplifyAuthConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Cognito User Pool configuration not found in amplify_outputs.json." },
        { status: 500 }
      );
    }

    const { userPoolId, region } = config;

    // 1. Verify the caller's AccessToken directly against Amazon Cognito GetUser
    const getUserResp = await fetch(
      `https://cognito-idp.${region}.amazonaws.com/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target": "AWSCognitoIdentityProviderService.GetUser",
        },
        body: JSON.stringify({ AccessToken: accessToken }),
        cache: "no-store",
      }
    );

    if (!getUserResp.ok) {
      return NextResponse.json(
        { error: "Invalid or expired Cognito access token." },
        { status: 401 }
      );
    }

    const getUserData = (await getUserResp.json()) as { Username?: string };
    const username = getUserData.Username;

    if (!username) {
      return NextResponse.json(
        { error: "Could not resolve authenticated Cognito username." },
        { status: 401 }
      );
    }

    // 2. Check existing Cognito groups for this user
    const existingGroupsData = await callCognitoAdminApi(
      region,
      "AdminListGroupsForUser",
      {
        UserPoolId: userPoolId,
        Username: username,
      }
    );

    const existingGroups = Array.isArray(existingGroupsData.Groups)
      ? (existingGroupsData.Groups as Array<{ GroupName?: string }>)
          .map((g) => g.GroupName)
          .filter((name): name is string => Boolean(name))
      : [];

    const existingAquiloopRole = ALL_AQUILOOP_ROLES.find((r) =>
      existingGroups.includes(r)
    );

    if (existingAquiloopRole) {
      return NextResponse.json({
        role: existingAquiloopRole,
        status: "EXISTING_GROUP_PRESERVED",
      });
    }

    // 3. Assign the user to their selected public group in Amazon Cognito
    await callCognitoAdminApi(region, "AdminAddUserToGroup", {
      UserPoolId: userPoolId,
      Username: username,
      GroupName: requestedRole,
    });

    return NextResponse.json({
      role: requestedRole,
      status: "ASSIGNED",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to assign Cognito role group.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
