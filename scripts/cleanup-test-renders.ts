/**
 * Cleanup script: Delete all final_vertical/final_horizontal render rows
 * for the test project to start fresh.
 *
 * Usage: npx tsx scripts/cleanup-test-renders.ts
 */

const SUPABASE_URL = "https://iiwsgivctcqlfqabytxp.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd3NnaXZjdGNxbGZxYWJ5dHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5MDkzOSwiZXhwIjoyMDg3MDY2OTM5fQ.dK8HRh29fdXd1XNqR57_5culzeovRIVpDerZdxS5srQ";
const PROJECT_ID = "23f17f37-88da-4634-9e4a-395d6b712f7e";

async function main() {
  console.log(`Cleaning up duplicate final renders for project ${PROJECT_ID}...`);

  // First, list all final renders
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/renders?project_id=eq.${PROJECT_ID}&type=in.(final_vertical,final_horizontal)&select=id,type,status,created_at`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  const renders = await listRes.json();
  console.log(`Found ${renders.length} final render rows:`);
  for (const r of renders) {
    console.log(`  ${r.id} | ${r.type} | ${r.status} | ${r.created_at}`);
  }

  if (renders.length === 0) {
    console.log("No renders to clean up.");
    return;
  }

  // Delete all of them
  const deleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/renders?project_id=eq.${PROJECT_ID}&type=in.(final_vertical,final_horizontal)`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
    }
  );

  const deleted = await deleteRes.json();
  console.log(`Deleted ${deleted.length} render rows.`);

  // Also reset project status to clips_ready
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "clips_ready",
        updated_at: new Date().toISOString(),
      }),
    }
  );

  const updated = await updateRes.json();
  console.log(`Updated project status to: ${updated[0]?.status}`);
  console.log("Done!");
}

main().catch(console.error);
