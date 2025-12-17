import { GarminClient } from './ingestion/garminClient';
import { adaptGarminToSessionStream } from './ingestion/garminAdapter';
import dotenv from 'dotenv';
import path from 'path';

// Load env 
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyGarminIntegration() {
  console.log("--- TEST RUNNER: Phase 9 (Garmin Integration) ---");

  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    console.warn("⚠️  Skipping live API test: GARMIN_EMAIL/PASSWORD not found in .env.local");
    console.log("Make sure to add them to test real connectivity.");
    return;
  }

  const client = new GarminClient({ email, password });

  try {
    // 1. Test Login
    console.log("Attempting Login...");
    await client.login();
    console.log("✅ Login Verified.");

    // 2. Fetch Recent Activities
    console.log("Fetching recent activities...");
    const activities = await client.getRecentActivities(1);

    if (activities.length === 0) {
      console.warn("⚠️  No recent activities found.");
      return;
    }
    console.log(`✅ Fetched ${activities.length} activity.`);

    // 3. Fetch Details
    const activityId = activities[0].activityId;
    console.log(`Fetching details for ID: ${activityId}...`);
    const details = await client.getActivityDetails(activityId);

    if (details) {
      console.log("✅ Details Fetched.");
      
      // 4. Test Adapter
      console.log("Running Adapter...");
      const stream = adaptGarminToSessionStream(details);
      console.log(`Converted Output: ${stream.dataPoints.length} data points.`);
      if (stream.dataPoints.length > 0) {
        console.log("Sample Point:", stream.dataPoints[0]);
        console.log("✅ Adapter Verified.");
      } else {
        console.warn("⚠️  Adapter returned empty stream (possibly no High-Res metrics in this activty).");
      }

    } else {
      console.error("❌ Failed to fetch details.");
    }

  } catch (error) {
    console.error("❌ Test Failed:", error);
  }
}

verifyGarminIntegration();
