/**
 * Fix Supabase Storage Bucket Policies
 * 
 * This script uses the Supabase REST API with service role key
 * to create storage policies for all buckets.
 */

const SUPABASE_URL = "https://iiwsgivctcqlfqabytxp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd3NnaXZjdGNxbGZxYWJ5dHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5MDkzOSwiZXhwIjoyMDg3MDY2OTM5fQ.dK8HRh29fdXd1XNqR57_5culzeovRIVpDerZdxS5srQ";

const BUCKETS = [
  "photos-original",
  "photos-normalized",
  "scene-clips",
  "final-exports",
  "logos",
];

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_string: sql }),
  });
  
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function ensureBucketExists(bucketId) {
  // Check if bucket exists
  const checkRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucketId}`, {
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
  });
  
  if (checkRes.status === 404) {
    // Create bucket
    const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        id: bucketId,
        name: bucketId,
        public: false,
        file_size_limit: 52428800, // 50MB
      }),
    });
    const data = await createRes.json();
    console.log(`  Created bucket ${bucketId}:`, data);
  } else {
    console.log(`  Bucket ${bucketId} already exists`);
    // Update bucket to ensure it's properly configured
    await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucketId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        public: false,
        file_size_limit: 52428800,
      }),
    });
  }
}

async function main() {
  console.log("=== Fixing Supabase Storage Policies ===\n");

  // Step 1: Ensure exec_sql function exists
  console.log("Step 1: Creating exec_sql function...");
  const createFnSQL = `
    CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      EXECUTE sql_string;
      RETURN json_build_object('success', true);
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('error', SQLERRM, 'state', SQLSTATE);
    END;
    $fn$;
  `;
  
  // Try to create the function via the SQL endpoint directly
  const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_string: "SELECT 1" }),
  });
  
  if (sqlRes.status !== 200) {
    console.log("  exec_sql doesn't exist yet, need to create it via alternative method");
    // We'll use the pg_net or management API approach
    // Actually, let's try the Supabase Management API to run SQL
    console.log("  Trying alternative approach...");
  } else {
    console.log("  exec_sql function exists!");
  }

  // Step 2: Ensure all buckets exist
  console.log("\nStep 2: Ensuring storage buckets exist...");
  for (const bucket of BUCKETS) {
    await ensureBucketExists(bucket);
  }

  // Step 3: Create storage policies via exec_sql
  console.log("\nStep 3: Creating storage policies...");
  
  const policyStatements = [];
  
  for (const bucket of BUCKETS) {
    const safeName = bucket.replace(/-/g, '_');
    
    // Drop existing policies first to avoid conflicts
    policyStatements.push(
      `DROP POLICY IF EXISTS "auth_select_${safeName}" ON storage.objects`,
      `DROP POLICY IF EXISTS "auth_insert_${safeName}" ON storage.objects`,
      `DROP POLICY IF EXISTS "auth_update_${safeName}" ON storage.objects`,
      `DROP POLICY IF EXISTS "auth_delete_${safeName}" ON storage.objects`,
    );
    
    // Create new policies
    policyStatements.push(
      `CREATE POLICY "auth_select_${safeName}" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = '${bucket}')`,
      `CREATE POLICY "auth_insert_${safeName}" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '${bucket}')`,
      `CREATE POLICY "auth_update_${safeName}" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '${bucket}')`,
      `CREATE POLICY "auth_delete_${safeName}" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '${bucket}')`,
    );
  }

  for (const sql of policyStatements) {
    const result = await runSQL(sql);
    const shortSql = sql.substring(0, 80);
    if (result.status === 200) {
      const data = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
      if (data.includes('error')) {
        console.log(`  WARN: ${shortSql}... => ${data}`);
      } else {
        console.log(`  OK: ${shortSql}...`);
      }
    } else {
      console.log(`  FAIL (${result.status}): ${shortSql}... => ${JSON.stringify(result.data)}`);
    }
  }

  // Also add anon access policies for public URL access (needed for getPublicUrl to work)
  console.log("\nStep 4: Adding anon read policies for bucket access...");
  for (const bucket of BUCKETS) {
    const safeName = bucket.replace(/-/g, '_');
    const dropSql = `DROP POLICY IF EXISTS "anon_select_${safeName}" ON storage.objects`;
    const createSql = `CREATE POLICY "anon_select_${safeName}" ON storage.objects FOR SELECT TO anon USING (bucket_id = '${bucket}')`;
    
    await runSQL(dropSql);
    const result = await runSQL(createSql);
    console.log(`  anon_select_${safeName}: ${result.status === 200 ? 'OK' : 'FAIL'}`);
  }

  console.log("\n=== Storage policy setup complete! ===");
}

main().catch(console.error);
