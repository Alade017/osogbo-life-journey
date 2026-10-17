import { readFileSync } from "node:fs";

const baseUrl = process.env.MAP_SMOKE_BASE_URL?.replace(/\/$/, "");
const token = process.env.MAP_SMOKE_ACCESS_TOKEN;
const allowMutation = process.env.MAP_SMOKE_ALLOW_MUTATION === "1";
if (!baseUrl || !token) {
  throw new Error("Set MAP_SMOKE_BASE_URL and MAP_SMOKE_ACCESS_TOKEN for a dedicated test player.");
}
if (!allowMutation) {
  throw new Error(
    "Set MAP_SMOKE_ALLOW_MUTATION=1 to acknowledge that travel and activities change test-player state.",
  );
}

const town = JSON.parse(
  readFileSync(new URL("../src/data/osogbo-town.json", import.meta.url), "utf8"),
);
const landmarks = town.landmarks;
if (landmarks.length !== 10)
  throw new Error(`Expected 10 Osogbo markers, found ${landmarks.length}.`);
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const acceptedTravelErrors = new Set(["ALREADY_TRAVELLING", "INSUFFICIENT_FUNDS", "ALREADY_THERE"]);
const acceptedActionErrors = new Set([
  "NOT_AT_PLACE",
  "PLACE_CLOSED",
  "INSUFFICIENT_FUNDS",
  "REQUIREMENT_NOT_MET",
  "COOLDOWN",
]);

async function body(response) {
  return response.json().catch(() => null);
}

const results = [];
for (const landmark of landmarks) {
  const detailResponse = await fetch(
    `${baseUrl}/api/map/landmark/${encodeURIComponent(landmark.id)}`,
    {
      headers,
    },
  );
  const details = await body(detailResponse);
  const detailOk = detailResponse.ok && details?.landmark?.id === landmark.id;

  const travelResponse = await fetch(`${baseUrl}/api/map/travel`, {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ destination_landmark_id: landmark.id }),
  });
  const travel = await body(travelResponse);
  const travelCode = travel?.error?.code;
  const travelOk = travelResponse.ok || acceptedTravelErrors.has(travelCode);

  const actionId = landmark.actions?.[0]?.id;
  let actionOk = true;
  let actionStatus = "no activity";
  if (actionId) {
    const actionResponse = await fetch(`${baseUrl}/api/map/action`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ landmarkId: landmark.id, actionId }),
    });
    const action = await body(actionResponse);
    const actionCode = action?.error?.code;
    actionOk = actionResponse.ok || acceptedActionErrors.has(actionCode);
    actionStatus = actionResponse.ok ? "ok" : (actionCode ?? `HTTP ${actionResponse.status}`);
  }

  results.push({
    id: landmark.id,
    details: detailOk ? "ok" : (details?.error?.code ?? `HTTP ${detailResponse.status}`),
    travel: travelResponse.ok ? "ok" : (travelCode ?? `HTTP ${travelResponse.status}`),
    activity: actionStatus,
    pass: detailOk && travelOk && actionOk,
  });
}

console.table(results);
const failures = results.filter((result) => !result.pass);
if (failures.length) {
  throw new Error(`${failures.length} live map marker checks failed.`);
}
console.log("All 10 live Osogbo marker endpoints responded with valid server outcomes.");
