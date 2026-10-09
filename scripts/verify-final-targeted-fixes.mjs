import fs from "node:fs";
import path from "node:path";
import { Amplify } from "aws-amplify";
import { signIn, signOut, fetchAuthSession } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";

const ROOT = process.cwd();
const amplifyOutputs = JSON.parse(
  fs.readFileSync(path.join(ROOT, "amplify_outputs.json"), "utf8")
);

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      env[k] = v;
    }
  }
  return env;
}

Amplify.configure(amplifyOutputs);
const client = generateClient();

async function main() {
  const env = loadEnvLocal();
  const demoPassword = env.AQUILOOP_DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error("Missing AQUILOOP_DEMO_PASSWORD in .env.local");
  }

  console.log("=== 1. VERIFYING WORKER SIGN-IN, ASSIGNED TASKS & BOUNTY CLAIM ===");
  await signOut().catch(() => {});

  // First ensure at least 2 OPEN bounties exist using Operator permissions
  await signIn({
    username: "operator.demo@aquiloop.test",
    password: demoPassword,
  });
  const { data: initialBounties } = await client.models.Bounty.list({
    limit: 50,
  });
  const currentOpen = initialBounties.filter((b) => b.status === "OPEN");
  if (currentOpen.length < 2) {
    const candidates = initialBounties.filter((b) => b.status === "CLAIMED");
    for (const c of candidates.slice(0, 2 - currentOpen.length)) {
      await client.models.Bounty.update({
        id: c.id,
        status: "OPEN",
        claimedBy: null,
      });
    }
  }
  await signOut();

  const workerSignIn = await signIn({
    username: "worker.demo@aquiloop.test",
    password: demoPassword,
  });
  if (!workerSignIn.isSignedIn) {
    throw new Error("Worker demo sign-in failed");
  }
  const workerSession = await fetchAuthSession();
  const workerGroups =
    workerSession.tokens?.accessToken?.payload?.["cognito:groups"] ?? [];
  console.log("Worker signed in, groups:", workerGroups);

  // Verify assigned pre-storm tasks in DynamoDB
  const { data: tasks, errors: taskErrors } = await client.models.Task.list({
    limit: 50,
  });
  if (taskErrors?.length) {
    throw new Error(`Task.list errors: ${JSON.stringify(taskErrors)}`);
  }
  const assignedCount = tasks.filter((t) => t.status === "ASSIGNED").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const submittedCount = tasks.filter(
    (t) => t.status === "SUBMITTED" || t.status === "VERIFIED"
  ).length;
  console.log(
    `Worker Pre-Storm Tasks -> Assigned: ${assignedCount}, In Progress: ${inProgressCount}, Submitted/Verified: ${submittedCount}`
  );

  // Verify Flood & Waste Bounty Claim -> Active Task transition
  const { data: bounties, errors: bountyErrors } =
    await client.models.Bounty.list({ limit: 50 });
  if (bountyErrors?.length) {
    throw new Error(`Bounty.list errors: ${JSON.stringify(bountyErrors)}`);
  }
  const openBounty = bounties.find((b) => b.status === "OPEN");
  if (!openBounty) {
    throw new Error("Expected at least one OPEN bounty in DynamoDB");
  }
  console.log(`Claiming OPEN bounty ${openBounty.id} (${openBounty.title})...`);
  const { data: claimedBounty, errors: claimErrors } =
    await client.models.Bounty.update({
      id: openBounty.id,
      status: "CLAIMED",
      claimedBy: "worker.demo@aquiloop.test",
      assignedAt: new Date().toISOString(),
    });
  if (claimErrors?.length || claimedBounty?.status !== "CLAIMED") {
    throw new Error(
      `Failed to claim bounty: ${JSON.stringify(claimErrors)}`
    );
  }
  console.log(
    `Verified bounty ${claimedBounty.id} transitioned to status=${claimedBounty.status}, claimedBy=${claimedBounty.claimedBy}`
  );

  console.log("\n=== 2. VERIFYING FAST S3 SIGNED URL GENERATION & PHOTO LOADING ===");
  const bountyWithPhotos = bounties.find(
    (b) => b.beforeEvidenceKey && b.afterEvidenceKey
  );
  if (!bountyWithPhotos) {
    throw new Error("No bounty with before/after S3 keys found");
  }
  const t0 = performance.now();
  const resUrl = await getUrl({
    path: bountyWithPhotos.beforeEvidenceKey,
    options: {
      expiresIn: 900,
      validateObjectExistence: false,
    },
  });
  const t1 = performance.now();
  const fetchResp = await fetch(resUrl.url.toString());
  console.log(
    `Signed URL generated in ${(t1 - t0).toFixed(1)}ms | HTTP ${fetchResp.status} (${fetchResp.headers.get("content-type")})`
  );
  if (!fetchResp.ok) {
    throw new Error(`Failed to load S3 photo: HTTP ${fetchResp.status}`);
  }

  console.log("\n=== 3. VERIFYING BUYER AVAILABLE LISTINGS (OPEN ONLY) & MY PICKUPS ===");
  await signOut();
  const buyerSignIn = await signIn({
    username: "buyer.demo@aquiloop.test",
    password: demoPassword,
  });
  if (!buyerSignIn.isSignedIn) {
    throw new Error("Buyer demo sign-in failed");
  }
  const { data: stubbleRecords, errors: stubbleErrors } =
    await client.models.StubbleListing.list({ limit: 50 });
  if (stubbleErrors?.length) {
    throw new Error(`StubbleListing.list errors: ${JSON.stringify(stubbleErrors)}`);
  }
  const availableOnly = stubbleRecords.filter((r) => r.status === "OPEN");
  const myPickupsOnly = stubbleRecords.filter((r) => r.status !== "OPEN");
  console.log(
    `Buyer Stubble Listings -> Available (status===OPEN): ${availableOnly.length}, My Pickups (status!==OPEN): ${myPickupsOnly.length}`
  );
  if (availableOnly.some((r) => r.status !== "OPEN")) {
    throw new Error("Non-OPEN record leaked into Available Listings!");
  }

  console.log("\n=== 4. VERIFYING FARMER SIGN-IN & MY LISTINGS ===");
  await signOut();
  const farmerSignIn = await signIn({
    username: "farmer.demo@aquiloop.test",
    password: demoPassword,
  });
  if (!farmerSignIn.isSignedIn) {
    throw new Error("Farmer demo sign-in failed");
  }
  console.log("Farmer signed in successfully.");

  console.log("\n=== 5. VERIFYING OPERATOR AI IMAGE ANALYSIS PANEL ===");
  await signOut();
  const operatorSignIn = await signIn({
    username: "operator.demo@aquiloop.test",
    password: demoPassword,
  });
  if (!operatorSignIn.isSignedIn) {
    throw new Error("Operator demo sign-in failed");
  }
  const { data: parsedAi, errors: aiErrors } =
    await client.mutations.verifyEvidence({
      evidenceType: "BOUNTY",
      resourceId: bountyWithPhotos.id,
      forceRecheck: false,
    });
  if (aiErrors?.length) {
    throw new Error(`verifyEvidence errors: ${JSON.stringify(aiErrors)}`);
  }
  console.log(
    "Operator AI Image Analysis status:",
    parsedAi?.status,
    "| assessment:",
    parsedAi?.verification?.overallAssessment,
    "| confidence:",
    parsedAi?.verification?.confidence
  );
  if (!parsedAi?.success) {
    throw new Error("Operator AI Image Analysis failed");
  }

  // Restore test-claimed bounty back to OPEN as Operator so interactive UI has OPEN bounties ready
  await client.models.Bounty.update({
    id: openBounty.id,
    status: "OPEN",
    claimedBy: null,
  });
  console.log(`Restored ${openBounty.id} to OPEN for interactive testing.`);

  await signOut();
  console.log("\nALL TARGETED FUNCTIONAL CHECKS PASSED.");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
