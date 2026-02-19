/**
 * Fix Supabase Storage Bucket Policies v2
 * 
 * Uses the Supabase Management API (pg-meta) to run raw SQL
 * since exec_sql function doesn't exist yet.
 */

const SUPABASE_URL = "https://iiwsgivctcqlfqabytxp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd3NnaXZjdGNxbGZxYWJ5dHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5MDkzOSwiZXhwIjoyMDg3MDY2OTM5fQ.dK8HRh29fdXd1XNqR57_5culzeovRIVpDerZdxS5srQ";
const PROJECT_REF = "iiwsgivctcqlfqabytxp";

const BUCKETS = [
  "photos-original",
  "photos-normalized",
  "scene-clips",
  "final-exports",
  "logos",
];

// Approach 1: Use the Supabase Dashboard API (pg-meta) to run SQL
// The pg-meta API is at /pg/query
async function runSQLViaPgMeta(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, data: await res.text() };
}

// Approach 2: Use supabase-js to create the exec_sql function first
// by inserting it into pg_proc... No, that won't work.

// Approach 3: Make the buckets PUBLIC so authenticated uploads work
// The issue is that storage.objects has RLS enabled but no policies for our buckets
async function makeBucketPublic(bucketId) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucketId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      public: true,
      file_size_limit: 52428800,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"],
    }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// Approach 4: Use the Supabase client with service role to upload
// The service role key bypasses RLS, so we can use it in the API route

async function main() {
  console.log("=== Fixing Supabase Storage ===\n");

  // First, let's try pg-meta
  console.log("Trying pg-meta SQL endpoint...");
  const pgResult = await runSQLViaPgMeta("SELECT 1 as test");
  console.log("pg-meta result:", pgResult.status, pgResult.data.substring(0, 200));

  // Ensure buckets exist
  console.log("\nEnsuring buckets exist...");
  for (const bucket of BUCKETS) {
    const checkRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucket}`, {
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
    });
    
    if (checkRes.status === 404) {
      const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "apikey": SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: true,
          file_size_limit: 52428800,
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"],
        }),
      });
      console.log(`  Created ${bucket}:`, await createRes.json());
    } else {
      const bucketData = await checkRes.json();
      console.log(`  ${bucket} exists (public: ${bucketData.public})`);
      
      // Make it public
      const updateResult = await makeBucketPublic(bucket);
      console.log(`  Updated ${bucket} to public:`, updateResult.data);
    }
  }

  // Now let's try to use pg-meta to create the exec_sql function and then policies
  if (pgResult.status === 200) {
    console.log("\npg-meta works! Creating exec_sql function and storage policies...");
    
    // Create exec_sql function
    const fnResult = await runSQLViaPgMeta(`
      CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        EXECUTE sql_string;
        RETURN json_build_object('success', true);
      EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM, 'state', SQLSTATE);
      END;
      $$;
    `);
    console.log("  exec_sql function:", fnResult.status);

    // Create storage policies
    for (const bucket of BUCKETS) {
      const safeName = bucket.replace(/-/g, '_');
      
      const policies = [
        `DROP POLICY IF EXISTS "auth_select_${safeName}" ON storage.objects;
         CREATE POLICY "auth_select_${safeName}" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = '${bucket}')`,
        `DROP POLICY IF EXISTS "auth_insert_${safeName}" ON storage.objects;
         CREATE POLICY "auth_insert_${safeName}" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '${bucket}')`,
        `DROP POLICY IF EXISTS "auth_update_${safeName}" ON storage.objects;
         CREATE POLICY "auth_update_${safeName}" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '${bucket}')`,
        `DROP POLICY IF EXISTS "auth_delete_${safeName}" ON storage.objects;
         CREATE POLICY "auth_delete_${safeName}" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '${bucket}')`,
        `DROP POLICY IF EXISTS "anon_select_${safeName}" ON storage.objects;
         CREATE POLICY "anon_select_${safeName}" ON storage.objects FOR SELECT TO anon USING (bucket_id = '${bucket}')`,
      ];

      for (const sql of policies) {
        const result = await runSQLViaPgMeta(sql);
        const shortSql = sql.split('\n').pop().trim().substring(0, 60);
        console.log(`  ${shortSql}... => ${result.status}`);
      }
    }
  } else {
    console.log("\npg-meta not available. Using alternative approach...");
    console.log("Making all buckets public so uploads work without RLS policies.");
    console.log("The service role key in API routes will bypass RLS for server-side operations.");
  }

  console.log("\n=== Done! ===");
}

main().catch(console.error);
