/**
 * AQUILOOP Idempotent AWS AppSync / DynamoDB + S3 Evidence Seed Script
 *
 * Usage:
 *   $env:AQUILOOP_OPERATOR_PASSWORD="<password>"; npm run seed
 *
 * Signs in as an authenticated OPERATOR in Amazon Cognito (ap-southeast-2),
 * idempotently seeds initial Delhi NCR Tasks, Bounties, StubbleListings,
 * and UserProfiles into DynamoDB via AppSync, uploads real PNG evidence
 * objects to the private S3 bucket (`bounties/...` and `stubble/...`),
 * and repairs any legacy/non-S3 evidence keys in DynamoDB so every stored
 * evidence key points to a real S3 object.
 */

import fs from "node:fs";
import path from "node:path";
import { Amplify } from "aws-amplify";
import { signIn, signOut, getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { uploadData } from "aws-amplify/storage";

const targetOutputsFile =
  process.env.AMPLIFY_OUTPUTS_PATH?.trim() || "amplify_outputs.json";
const outputsPath = path.resolve(process.cwd(), targetOutputsFile);
if (!fs.existsSync(outputsPath)) {
  console.error(`ERROR: ${targetOutputsFile} not found.`);
  process.exit(1);
}

const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf8"));
Amplify.configure(outputs);

function resolveSeedPassword() {
  if (process.env.AQUILOOP_DEMO_PASSWORD) {
    return process.env.AQUILOOP_DEMO_PASSWORD;
  }
  if (process.env.AQUILOOP_OPERATOR_PASSWORD) {
    return process.env.AQUILOOP_OPERATOR_PASSWORD;
  }
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, "utf8").split(/\r?\n/);
    let fallbackOperatorPass = "";
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
      if (key === "AQUILOOP_OPERATOR_PASSWORD" && val) {
        fallbackOperatorPass = val;
      }
    }
    if (fallbackOperatorPass) return fallbackOperatorPass;
  }
  return "";
}

const OPERATOR_EMAIL =
  process.env.AQUILOOP_OPERATOR_EMAIL || "operator.demo@aquiloop.test";
const OPERATOR_PASSWORD = resolveSeedPassword();

if (!OPERATOR_PASSWORD) {
  console.error(
    "Missing AQUILOOP_DEMO_PASSWORD (or AQUILOOP_OPERATOR_PASSWORD).\n" +
      "Set AQUILOOP_DEMO_PASSWORD in .env.local (gitignored) or in your shell environment before running `npm run seed`."
  );
  process.exit(1);
}

const DEMO_EVIDENCE_DIR = path.resolve(process.cwd(), "public", "demo-evidence");
const DRAIN_BEFORE_JPG = fs.readFileSync(
  path.join(DEMO_EVIDENCE_DIR, "drain-before.jpg")
);
const DRAIN_AFTER_JPG = fs.readFileSync(
  path.join(DEMO_EVIDENCE_DIR, "drain-after.jpg")
);
const STUBBLE_PROOF_JPG = fs.readFileSync(
  path.join(DEMO_EVIDENCE_DIR, "stubble-proof.jpg")
);

function isRealisticJpgS3Key(key) {
  return (
    typeof key === "string" &&
    (key.startsWith("bounties/") ||
      key.startsWith("stubble/") ||
      key.startsWith("tasks/")) &&
    (key.endsWith(".jpg") || key.endsWith(".jpeg") || key.endsWith(".webp"))
  );
}

async function uploadRealEvidenceJpg(s3Path, buffer) {
  const task = uploadData({
    path: s3Path,
    data: buffer,
    options: {
      contentType: "image/jpeg",
    },
  });
  const res = await task.result;
  return res.path;
}

const INITIAL_TASKS = [
  {
    title: "Deploy Standby Silt-Vac Unit — Mayapuri Culvert #11",
    description:
      "[MSN-201] Zone: zone-03 | Impact: 88000 | Pre-storm desilting and inlet grate clearance before peak runoff",
    locationName: "Mayapuri Industrial Phase I · Culvert #11",
    latitude: 28.6224,
    longitude: 77.1162,
    taskType: "DRAIN_CLEARING",
    priority: "CRITICAL",
    status: "PENDING",
    assignedTeam: "Unassigned — Awaiting Dispatch",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Within 2 hours",
  },
  {
    title: "Open Overflow Sluice & Check Recharge Weir #2",
    description:
      "[MSN-202] Zone: zone-01 | Impact: 110000 | Pre-position overflow gate along Najafgarh Feeder #2",
    locationName: "Najafgarh Drain Corridor · Feeder #2",
    latitude: 28.6141,
    longitude: 76.9942,
    taskType: "FLOOD_RESPONSE",
    priority: "HIGH",
    status: "PENDING",
    assignedTeam: "Unassigned — Awaiting Dispatch",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Within 3 hours",
  },
  {
    title: "Clear Drain #17 Debris Grate",
    description:
      "[MSN-204] Zone: zone-03 | Impact: 92000 | Pre-storm grate clearance at Mayapuri Industrial Phase I",
    locationName: "Mayapuri Industrial Phase I",
    latitude: 28.6219,
    longitude: 77.1154,
    taskType: "DRAIN_CLEARING",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    assignedTeam: "Drain Clearance Unit B",
    assignedWorkerId: "worker.demo@aquiloop.test",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Within 3 hours",
  },
  {
    title: "Divert Runoff to Recharge Pit #3",
    description:
      "[MSN-209] Zone: zone-03 | Impact: 74000 | Open intake gate and inspect silt trap",
    locationName: "Mayapuri — Naraina Basin",
    latitude: 28.6275,
    longitude: 77.1238,
    taskType: "WATER_ASSET_CHECK",
    priority: "HIGH",
    status: "ASSIGNED",
    assignedTeam: "Recharge Engineering Crew C",
    assignedWorkerId: "worker.demo@aquiloop.test",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Within 4 hours",
  },
  {
    title: "Clear Intake Screen — Najafgarh Outfall #4",
    description:
      "[MSN-212] Zone: zone-01 | Impact: 135000 | Remove floating solid waste before peak discharge",
    locationName: "Najafgarh Drain Corridor",
    latitude: 28.6134,
    longitude: 76.9935,
    taskType: "DRAIN_CLEARING",
    priority: "CRITICAL",
    status: "SUBMITTED",
    assignedTeam: "Rapid Hydro-Response Team A",
    assignedWorkerId: "worker.demo@aquiloop.test",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Within 2 hours",
  },
  {
    title: "Inspect Check-Weir #2 & Desilt Channel",
    description:
      "[MSN-218] Zone: zone-02 | Impact: 68000 | Verify check-weir sluice seal at Dwarka Sector 8",
    locationName: "Dwarka Sector 8 Stormwater Channel",
    latitude: 28.5745,
    longitude: 77.065,
    taskType: "DRAIN_INSPECTION",
    priority: "HIGH",
    status: "VERIFIED",
    assignedTeam: "Interceptor Gate Ops D",
    assignedWorkerId: "worker.demo@aquiloop.test",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Completed",
    verifiedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    title: "Verify Bioswale Percolation Trench #4",
    description:
      "[MSN-221] Zone: zone-04 | Impact: 51000 | Check trench gravel filter bed at Vasant Kunj",
    locationName: "Vasant Kunj Institutional Ridge",
    latitude: 28.5293,
    longitude: 77.1532,
    taskType: "WATER_ASSET_CHECK",
    priority: "MEDIUM",
    status: "ASSIGNED",
    assignedTeam: "Community Resilience Volunteers",
    createdBy: "operator.demo@aquiloop.test",
    deadline: "Within 6 hours",
  },
];

const INITIAL_BOUNTIES = [
  {
    title: "Clear plastic & packaging blockage at Drain Inlet #17",
    description:
      "[BOUNTY #DL-0041] Priority:URGENT | Waste:35–45 kg | Deadline:Before rainfall peak (Within 3h) | Heavy plastic film obstructing Mayapuri Phase II storm grate",
    locationName: "Mayapuri Industrial Area Phase II · Storm Grate #17",
    latitude: 28.6214,
    longitude: 77.1149,
    bountyType: "DRAIN_WASTE",
    rewardArc: 160,
    status: "OPEN",
    createdBy: "operator.demo@aquiloop.test",
  },
  {
    title: "Remove floating solid waste at Najafgarh culvert screen",
    description:
      "[BOUNTY #DL-0043] Priority:URGENT | Waste:50–65 kg | Deadline:Within 3h | Pre-monsoon surge bottleneck along Najafgarh culvert",
    locationName: "Najafgarh Drain Culvert · Kakrola Bridge",
    latitude: 28.6105,
    longitude: 77.0085,
    bountyType: "PLASTIC",
    rewardArc: 180,
    status: "OPEN",
    createdBy: "operator.demo@aquiloop.test",
  },
  {
    title: "Clear stormwater catch-basin litter at Dwarka Sector 8",
    description:
      "[BOUNTY #DL-0045] Priority:HIGH | Waste:25–35 kg | Deadline:Within 5h | Prevent recharge pit siltation from roadside plastic waste",
    locationName: "Dwarka Sector 8 · Recharge Feeder Channel #3",
    latitude: 28.5738,
    longitude: 77.0682,
    bountyType: "DRAIN_WASTE",
    rewardArc: 120,
    status: "IN_PROGRESS",
    createdBy: "operator.demo@aquiloop.test",
    claimedBy: "worker.demo@aquiloop.test",
    assignedAt: new Date(Date.now() - 5400 * 1000).toISOString(),
  },
  {
    title: "Unblock Bawana industrial feeder drain grate #09",
    description:
      "[BOUNTY #DL-0046] Priority:HIGH | Waste:40–55 kg | Deadline:Submitted for review | Industrial packaging debris cleared from storm inlet",
    locationName: "Bawana Sector 3 · Industrial Storm Outfall #09",
    latitude: 28.7968,
    longitude: 77.0365,
    bountyType: "WASTE",
    rewardArc: 140,
    status: "SUBMITTED",
    createdBy: "operator.demo@aquiloop.test",
    claimedBy: "worker.demo@aquiloop.test",
    assignedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    submittedLatitude: 28.7968,
    submittedLongitude: 77.0365,
    submittedTimestamp: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
  {
    title: "Clear Rohini Sector 11 roadside storm channel",
    description:
      "[BOUNTY #DL-0048] Priority:MEDIUM | Waste:20–30 kg | Deadline:Verified & Credited | Cleared solid waste before monsoon pulse",
    locationName: "Rohini Sector 11 · Collector Drain North",
    latitude: 28.7362,
    longitude: 77.1128,
    bountyType: "DRAIN_WASTE",
    rewardArc: 110,
    status: "VERIFIED",
    createdBy: "operator.demo@aquiloop.test",
    claimedBy: "worker.demo@aquiloop.test",
    assignedAt: new Date(Date.now() - 14400 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 10800 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    submittedLatitude: 28.7362,
    submittedLongitude: 77.1128,
    submittedTimestamp: new Date(Date.now() - 10800 * 1000).toISOString(),
  },
];

const INITIAL_STUBBLE_LISTINGS = [
  {
    farmerId: "farmer.demo@aquiloop.test",
    farmerName: "Harpreet Singh · Najafgarh Plot #12",
    locationName: "Najafgarh Agricultural Belt · Plot #12",
    latitude: 28.609,
    longitude: 76.9855,
    quantity: 2.4,
    unit: "tonnes",
    cropType: "Paddy Stubble",
    priceOrReward: 240,
    description:
      "[STB #DL-018] Title:Paddy Stubble — Dry / Baled (Najafgarh) | Condition:Dry / Baled | Window:10–12 Oct (08:00 – 17:00 IST) | Address:Plot #12, Near Najafgarh Drain Service Road, Gate 2 | Tractor-accessible field gate near Najafgarh canal road.",
    status: "OPEN",
    pickupDate: "10–12 Oct (08:00 – 17:00 IST)",
  },
  {
    farmerId: "farmer.demo@aquiloop.test",
    farmerName: "Ramesh Dahiya · Narela Kisan Cluster",
    locationName: "Narela Border Farming Zone · Sector B",
    latitude: 28.8527,
    longitude: 77.0929,
    quantity: 3.2,
    unit: "tonnes",
    cropType: "Paddy Stubble",
    priceOrReward: 320,
    description:
      "[STB #DL-019] Title:Paddy Stubble — Dry / Baled (Narela) | Condition:Dry / Baled | Window:11–13 Oct (07:30 – 16:30 IST) | Address:Khasra 44/2, NH-44 Service Lane, Narela Mandi Approach | Baled and stacked along NH-44 service lane.",
    status: "OPEN",
    pickupDate: "11–13 Oct (07:30 – 16:30 IST)",
  },
  {
    farmerId: "farmer.demo@aquiloop.test",
    farmerName: "Surender Rana · Bawana Cooperative",
    locationName: "Bawana Rural Belt · Canal Plot #07",
    latitude: 28.7972,
    longitude: 77.0344,
    quantity: 1.8,
    unit: "tonnes",
    cropType: "Wheat Stubble",
    priceOrReward: 180,
    description:
      "[STB #DL-020] Title:Wheat Stubble — Field Stacked / Ready (Bawana) | Condition:Field Stacked / Ready | Window:10 Oct · 11:00 IST | Address:Canal Plot #07, Western Yamuna Canal Bund Road, Bawana | Ready for immediate loader pickup.",
    status: "SCHEDULED",
    acceptedBy: "buyer.demo@aquiloop.test",
    pickupDate: "10 Oct · 11:00 IST",
  },
  {
    farmerId: "farmer.demo@aquiloop.test",
    farmerName: "Vikram Malik · Sonipat NCR Belt",
    locationName: "Sonipat South Agricultural Corridor",
    latitude: 28.9931,
    longitude: 77.0151,
    quantity: 2.8,
    unit: "tonnes",
    cropType: "Paddy Stubble",
    priceOrReward: 280,
    description:
      "[STB #DL-021] Title:Paddy Stubble — Dry / Baled (Sonipat) | Condition:Dry / Baled | Window:08 Oct · 15:30 IST | Address:Plot 19, Kundli-Sonipat Link Road, Near Weighbridge #3 | Weighbridge slip and loading photo attached.",
    status: "PENDING_VERIFICATION",
    acceptedBy: "buyer.demo@aquiloop.test",
    pickupDate: "08 Oct · 15:30 IST",
    pickedUpAt: new Date(Date.now() - 5400 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    farmerId: "farmer.demo@aquiloop.test",
    farmerName: "Kartar Verma · Alipur Farm #04",
    locationName: "Alipur Agricultural Block · Plot #04",
    latitude: 28.7978,
    longitude: 77.1331,
    quantity: 2.1,
    unit: "tonnes",
    cropType: "Mixed Crop Residue",
    priceOrReward: 210,
    description:
      "[STB #DL-022] Title:Mixed Crop Residue — Dry / Baled (Alipur) | Condition:Dry / Baled | Window:Completed | Address:Farm #04, Old GT Karnal Road, Alipur Block | Verified biomass recovery for mulch & compost.",
    status: "VERIFIED",
    acceptedBy: "buyer.demo@aquiloop.test",
    pickupDate: "05 Oct · Completed",
    pickedUpAt: new Date(Date.now() - 18000 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 14400 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 10800 * 1000).toISOString(),
  },
];

async function runSeed() {
  console.log(`Signing in as OPERATOR (${OPERATOR_EMAIL})...`);
  try {
    await signOut();
  } catch {
    // ignore
  }

  const signInRes = await signIn({
    username: OPERATOR_EMAIL,
    password: OPERATOR_PASSWORD,
  });
  if (!signInRes.isSignedIn) {
    throw new Error(`Sign-in incomplete: ${JSON.stringify(signInRes.nextStep)}`);
  }

  const currentUser = await getCurrentUser();
  const client = generateClient({ authMode: "userPool" });

  // 1. Ensure Operator UserProfile
  console.log("Ensuring Operator UserProfile...");
  const { data: existingProfile } = await client.models.UserProfile.get({
    id: currentUser.userId,
  });
  if (!existingProfile) {
    await client.models.UserProfile.create({
      id: currentUser.userId,
      email: OPERATOR_EMAIL,
      displayName: "Delhi NCR Resilience Operator",
      role: "OPERATOR",
    });
    console.log("  Created Operator UserProfile.");
  } else {
    console.log("  Operator UserProfile already exists.");
  }

  // 2. Seed Tasks idempotently
  const { data: existingTasks, errors: taskListErrors } =
    await client.models.Task.list({ limit: 100 });
  if (taskListErrors?.length) {
    throw new Error(JSON.stringify(taskListErrors));
  }
  const existingTaskMap = new Map((existingTasks ?? []).map((t) => [t.title, t]));
  let createdTasks = 0;
  for (const item of INITIAL_TASKS) {
    const existing = existingTaskMap.get(item.title);
    if (!existing) {
      const { errors } = await client.models.Task.create(item);
      if (errors?.length) {
        throw new Error(`Task create failed: ${JSON.stringify(errors)}`);
      }
      createdTasks++;
    } else if (
      existing.status !== item.status ||
      existing.assignedTeam !== item.assignedTeam ||
      existing.assignedWorkerId !== (item.assignedWorkerId ?? null) ||
      existing.createdBy !== item.createdBy
    ) {
      await client.models.Task.update({
        id: existing.id,
        status: item.status,
        assignedTeam: item.assignedTeam,
        assignedWorkerId: item.assignedWorkerId ?? null,
        createdBy: item.createdBy,
      });
    }
  }
  console.log(
    `Tasks: ${createdTasks} created (${(existingTasks ?? []).length} already existed).`
  );

  // 3. Seed Bounties idempotently & ensure real S3 objects for evidence keys
  const { data: existingBounties, errors: bountyListErrors } =
    await client.models.Bounty.list({ limit: 100 });
  if (bountyListErrors?.length) {
    throw new Error(JSON.stringify(bountyListErrors));
  }
  const existingBountyMap = new Map(
    (existingBounties ?? []).map((b) => [b.title, b])
  );
  let createdBounties = 0;
  for (const item of INITIAL_BOUNTIES) {
    if (!existingBountyMap.has(item.title)) {
      const { data: created, errors } = await client.models.Bounty.create(item);
      if (errors?.length || !created) {
        throw new Error(`Bounty create failed: ${JSON.stringify(errors)}`);
      }
      existingBountyMap.set(created.title, created);
      createdBounties++;
    }
  }
  console.log(
    `Bounties: ${createdBounties} created (${(existingBounties ?? []).length} already existed).`
  );

  // Repair/seed real photographic JPEG S3 evidence objects for all Bounties in DynamoDB
  const canonicalByTitle = new Map(INITIAL_BOUNTIES.map((b) => [b.title, b]));
  const { data: allBounties } = await client.models.Bounty.list({ limit: 100 });
  let s3BountyUpserts = 0;
  for (const bounty of allBounties ?? []) {
    const canonical = canonicalByTitle.get(bounty.title);
    const targetStatus = canonical ? canonical.status : bounty.status;
    const updatePatch = {};

    if (canonical && (bounty.status !== canonical.status || bounty.claimedBy !== canonical.claimedBy)) {
      updatePatch.status = canonical.status;
      if (canonical.claimedBy) {
        updatePatch.claimedBy = canonical.claimedBy;
      }
      if (canonical.assignedAt) {
        updatePatch.assignedAt = canonical.assignedAt;
      }
      if (canonical.submittedAt) {
        updatePatch.submittedAt = canonical.submittedAt;
      }
      if (canonical.submittedLatitude !== undefined) {
        updatePatch.submittedLatitude = canonical.submittedLatitude;
      }
      if (canonical.submittedLongitude !== undefined) {
        updatePatch.submittedLongitude = canonical.submittedLongitude;
      }
      if (canonical.submittedTimestamp) {
        updatePatch.submittedTimestamp = canonical.submittedTimestamp;
      }
    }

    const needsBefore =
      targetStatus === "IN_PROGRESS" ||
      targetStatus === "SUBMITTED" ||
      targetStatus === "UNDER_REVIEW" ||
      targetStatus === "VERIFIED";
    const needsAfter =
      targetStatus === "SUBMITTED" ||
      targetStatus === "UNDER_REVIEW" ||
      targetStatus === "VERIFIED";

    if (
      needsBefore &&
      (!isRealisticJpgS3Key(bounty.beforeEvidenceKey) ||
        bounty.beforeEvidenceKey.includes("drain-before-demo.jpg"))
    ) {
      const key = `bounties/${bounty.id}/before/drain-before-demo.jpg`;
      await uploadRealEvidenceJpg(key, DRAIN_BEFORE_JPG);
      updatePatch.beforeEvidenceKey = key;
      s3BountyUpserts++;
    } else if (!needsBefore && bounty.beforeEvidenceKey) {
      updatePatch.beforeEvidenceKey = null;
    }

    if (
      needsAfter &&
      (!isRealisticJpgS3Key(bounty.afterEvidenceKey) ||
        bounty.afterEvidenceKey.includes("drain-after-demo.jpg"))
    ) {
      const key = `bounties/${bounty.id}/after/drain-after-demo.jpg`;
      await uploadRealEvidenceJpg(key, DRAIN_AFTER_JPG);
      updatePatch.afterEvidenceKey = key;
      s3BountyUpserts++;
    } else if (!needsAfter && bounty.afterEvidenceKey) {
      updatePatch.afterEvidenceKey = null;
    }

    if (Object.keys(updatePatch).length > 0) {
      const { errors } = await client.models.Bounty.update({
        id: bounty.id,
        ...updatePatch,
      });
      if (errors?.length) {
        throw new Error(`Bounty S3 key update failed: ${JSON.stringify(errors)}`);
      }
    }
  }
  console.log(`Bounty S3 Evidence Objects uploaded/linked: ${s3BountyUpserts}`);

  // 4. Seed StubbleListings idempotently & ensure real JPEG S3 objects for proofKey
  const { data: existingStubble, errors: stubbleListErrors } =
    await client.models.StubbleListing.list({ limit: 100 });
  if (stubbleListErrors?.length) {
    throw new Error(JSON.stringify(stubbleListErrors));
  }
  const existingStubbleLocations = new Set(
    (existingStubble ?? []).map((s) => s.locationName)
  );
  let createdStubble = 0;
  for (const item of INITIAL_STUBBLE_LISTINGS) {
    if (!existingStubbleLocations.has(item.locationName)) {
      const { errors } = await client.models.StubbleListing.create(item);
      if (errors?.length) {
        throw new Error(
          `StubbleListing create failed: ${JSON.stringify(errors)}`
        );
      }
      createdStubble++;
    }
  }
  console.log(
    `StubbleListings: ${createdStubble} created (${(existingStubble ?? []).length} already existed).`
  );

  const canonicalStubbleByLoc = new Map(
    INITIAL_STUBBLE_LISTINGS.map((s) => [s.locationName, s])
  );
  const { data: allStubble } = await client.models.StubbleListing.list({
    limit: 100,
  });
  let s3StubbleUpserts = 0;
  for (const listing of allStubble ?? []) {
    const canonical = canonicalStubbleByLoc.get(listing.locationName);
    const needsProof =
      (canonical ? canonical.status : listing.status) === "PENDING_VERIFICATION" ||
      (canonical ? canonical.status : listing.status) === "VERIFIED";

    const stubblePatch = {};
    if (canonical) {
      if (listing.farmerId !== canonical.farmerId) {
        stubblePatch.farmerId = canonical.farmerId;
      }
      if (canonical.acceptedBy && listing.acceptedBy !== canonical.acceptedBy) {
        stubblePatch.acceptedBy = canonical.acceptedBy;
      }
      if (listing.description !== canonical.description) {
        stubblePatch.description = canonical.description;
      }
      if (listing.pickupDate !== canonical.pickupDate) {
        stubblePatch.pickupDate = canonical.pickupDate;
      }
      if (listing.status !== canonical.status) {
        stubblePatch.status = canonical.status;
      }
    }

    if (
      needsProof &&
      (!isRealisticJpgS3Key(listing.proofKey) ||
        listing.proofKey.includes("stubble-proof-demo.jpg"))
    ) {
      const key = `stubble/${listing.id}/proof/stubble-proof-demo.jpg`;
      await uploadRealEvidenceJpg(key, STUBBLE_PROOF_JPG);
      stubblePatch.proofKey = key;
      s3StubbleUpserts++;
    } else if (!needsProof && listing.proofKey && !isRealisticJpgS3Key(listing.proofKey)) {
      stubblePatch.proofKey = null;
    }

    if (Object.keys(stubblePatch).length > 0) {
      const { errors } = await client.models.StubbleListing.update({
        id: listing.id,
        ...stubblePatch,
      });
      if (errors?.length) {
        throw new Error(
          `StubbleListing S3 key update failed: ${JSON.stringify(errors)}`
        );
      }
    }
  }
  console.log(`Stubble S3 Proof Objects uploaded/linked: ${s3StubbleUpserts}`);

  // 5. Trigger real Open-Meteo weather ingestion for all 8 Delhi/NCR locations
  console.log("Triggering Open-Meteo weather ingestion (refreshWeatherForecast)...");
  const weatherRes = await client.mutations.refreshWeatherForecast({
    locationKey: "ALL",
  });
  if (weatherRes.errors?.length) {
    throw new Error(
      `Weather ingestion failed: ${JSON.stringify(weatherRes.errors)}`
    );
  }
  console.log(
    `WeatherForecast: ${weatherRes.data?.recordsUpserted ?? 0} hourly records upserted across ${weatherRes.data?.locationsProcessed ?? 0} locations (source: ${weatherRes.data?.source}).`
  );

  await signOut();
  console.log("Seed complete.");
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
