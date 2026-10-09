/**
 * AQUILOOP — Idempotent Demo Users Provisioning Script
 *
 * Usage:
 *   npm run seed:users
 *
 * Reads AQUILOOP_DEMO_PASSWORD from .env.local (or process.env) and uses
 * existing AWS credentials + Cognito AdminSetUserPassword (--permanent) to set
 * the shared demo password as permanent for all four existing test users in
 * ap-southeast-2, preserving their confirmed status and Cognito group membership:
 *   - operator.demo@aquiloop.test -> OPERATOR
 *   - worker.demo@aquiloop.test   -> WORKER
 *   - farmer.demo@aquiloop.test   -> FARMER
 *   - buyer.demo@aquiloop.test    -> BUYER
 *
 * Security:
 *   - Never hardcodes or logs the password.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Amplify } from "aws-amplify";
import {
  signIn,
  signOut,
  fetchAuthSession,
  getCurrentUser,
} from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";

function loadLocalEnvPassword() {
  if (process.env.AQUILOOP_DEMO_PASSWORD?.trim()) {
    return process.env.AQUILOOP_DEMO_PASSWORD.trim();
  }
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key === "AQUILOOP_DEMO_PASSWORD" && val) {
        return val;
      }
    }
  }
  return "";
}

const DEMO_PASSWORD = loadLocalEnvPassword();
if (!DEMO_PASSWORD) {
  console.error(
    "ERROR: Missing AQUILOOP_DEMO_PASSWORD.\n" +
      "Set AQUILOOP_DEMO_PASSWORD in .env.local (gitignored) before running `npm run seed:users`."
  );
  process.exit(1);
}

const targetOutputsFile =
  process.env.AMPLIFY_OUTPUTS_PATH?.trim() || "amplify_outputs.json";
const outputsPath = path.resolve(process.cwd(), targetOutputsFile);
if (!fs.existsSync(outputsPath)) {
  console.error(`ERROR: ${targetOutputsFile} not found.`);
  process.exit(1);
}

const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf8"));
Amplify.configure(outputs);

const USER_POOL_ID = outputs.auth?.user_pool_id;
const AWS_REGION = outputs.auth?.aws_region || "ap-southeast-2";

if (!USER_POOL_ID) {
  console.error("ERROR: auth.user_pool_id missing in amplify_outputs.json.");
  process.exit(1);
}

const ALL_ROLES = ["OPERATOR", "WORKER", "FARMER", "BUYER"];

export const DEMO_USERS = [
  {
    email: "operator.demo@aquiloop.test",
    role: "OPERATOR",
    displayName: "Delhi NCR Operations Control",
  },
  {
    email: "worker.demo@aquiloop.test",
    role: "WORKER",
    displayName: "Ramesh Kumar (Field Worker)",
  },
  {
    email: "farmer.demo@aquiloop.test",
    role: "FARMER",
    displayName: "Harpreet Singh (Najafgarh Plot #12)",
  },
  {
    email: "buyer.demo@aquiloop.test",
    role: "BUYER",
    displayName: "GreenPellet NCR Bio-Energy",
  },
];

function runAwsCli(args) {
  return execFileSync(
    "aws",
    [...args, "--region", AWS_REGION, "--output", "json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
}

function userExists(email) {
  try {
    runAwsCli([
      "cognito-idp",
      "admin-get-user",
      "--user-pool-id",
      USER_POOL_ID,
      "--username",
      email,
    ]);
    return true;
  } catch {
    return false;
  }
}

function provisionCognitoDemoUser({ email, role }) {
  const exists = userExists(email);
  if (!exists) {
    runAwsCli([
      "cognito-idp",
      "admin-create-user",
      "--user-pool-id",
      USER_POOL_ID,
      "--username",
      email,
      "--message-action",
      "SUPPRESS",
      "--user-attributes",
      `Name=email,Value=${email}`,
      "Name=email_verified,Value=true",
    ]);
    console.log(`  [+] Created Cognito user: ${email}`);
  } else {
    runAwsCli([
      "cognito-idp",
      "admin-update-user-attributes",
      "--user-pool-id",
      USER_POOL_ID,
      "--username",
      email,
      "--user-attributes",
      `Name=email,Value=${email}`,
      "Name=email_verified,Value=true",
    ]);
    console.log(`  [=] Existing Cognito user confirmed: ${email}`);
  }

  // Set permanent password via AdminSetUserPassword without logging the password
  runAwsCli([
    "cognito-idp",
    "admin-set-user-password",
    "--user-pool-id",
    USER_POOL_ID,
    "--username",
    email,
    "--password",
    DEMO_PASSWORD,
    "--permanent",
  ]);

  // Ensure group membership matches target role
  const groupsRaw = runAwsCli([
    "cognito-idp",
    "admin-list-groups-for-user",
    "--user-pool-id",
    USER_POOL_ID,
    "--username",
    email,
  ]);
  const currentGroups = (JSON.parse(groupsRaw).Groups || []).map(
    (g) => g.GroupName
  );

  for (const existingGroup of currentGroups) {
    if (existingGroup !== role && ALL_ROLES.includes(existingGroup)) {
      runAwsCli([
        "cognito-idp",
        "admin-remove-user-from-group",
        "--user-pool-id",
        USER_POOL_ID,
        "--username",
        email,
        "--group-name",
        existingGroup,
      ]);
    }
  }

  if (!currentGroups.includes(role)) {
    runAwsCli([
      "cognito-idp",
      "admin-add-user-to-group",
      "--user-pool-id",
      USER_POOL_ID,
      "--username",
      email,
      "--group-name",
      role,
    ]);
  }
}

async function verifySignInAndProfile({ email, role, displayName }) {
  try {
    await signOut();
  } catch {
    // ignore
  }

  const res = await signIn({
    username: email,
    password: DEMO_PASSWORD,
  });

  if (!res.isSignedIn) {
    throw new Error(
      `Sign-in did not complete for ${email}: ${JSON.stringify(res.nextStep)}`
    );
  }

  const session = await fetchAuthSession();
  const groups =
    session.tokens?.accessToken?.payload?.["cognito:groups"] ||
    session.tokens?.idToken?.payload?.["cognito:groups"] ||
    [];

  if (!Array.isArray(groups) || !groups.includes(role)) {
    throw new Error(
      `Expected Cognito group ${role} for ${email}, found: ${JSON.stringify(groups)}`
    );
  }

  const currentUser = await getCurrentUser();
  const client = generateClient({ authMode: "userPool" });

  const { data: existingProfile } = await client.models.UserProfile.get({
    id: currentUser.userId,
  });

  if (!existingProfile) {
    const { errors } = await client.models.UserProfile.create({
      id: currentUser.userId,
      email,
      displayName,
      role,
    });
    if (errors?.length) {
      throw new Error(
        `UserProfile create failed for ${email}: ${JSON.stringify(errors)}`
      );
    }
  } else if (
    existingProfile.email !== email ||
    existingProfile.role !== role ||
    existingProfile.displayName !== displayName
  ) {
    await client.models.UserProfile.update({
      id: currentUser.userId,
      email,
      displayName,
      role,
    });
  }

  await signOut();
  console.log(
    `  [✓] Verified real Cognito sign-in, permanent password, group (${role}), and UserProfile for ${email}`
  );
}

async function main() {
  console.log(
    `Synchronizing AQUILOOP .test demo users in User Pool ${USER_POOL_ID} (${AWS_REGION})...`
  );

  for (const user of DEMO_USERS) {
    provisionCognitoDemoUser(user);
    await verifySignInAndProfile(user);
  }

  console.log("All 4 AQUILOOP .test demo accounts are synchronized and verified.");
}

main().catch((err) => {
  console.error("Demo user provisioning failed:", err.message || err);
  process.exit(1);
});
