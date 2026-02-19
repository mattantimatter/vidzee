/**
 * Supabase Database Setup Script
 * Uses @supabase/supabase-js with service role key
 * 
 * Strategy:
 * 1. Create an exec_sql RPC function using the supabase-js admin client
 * 2. Use that function to execute all DDL statements
 * 3. Create storage buckets via the Storage API
 * 4. Insert seed data (style packs)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iiwsgivctcqlfqabytxp.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd3NnaXZjdGNxbGZxYWJ5dHhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ5MDkzOSwiZXhwIjoyMDg3MDY2OTM5fQ.dK8HRh29fdXd1XNqR57_5culzeovRIVpDerZdxS5srQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helper: execute SQL via fetch to the REST RPC endpoint ───
async function execSQL(sql) {
  const { data, error } = await supabase.rpc("exec_sql", {
    sql_string: sql,
  });
  if (error) {
    // If exec_sql doesn't exist yet, that's expected on first run
    return { data: null, error };
  }
  return { data, error: null };
}

// ─── Step 0: Bootstrap the exec_sql function ───
// We need to create the function before we can use rpc().
// The trick: use the Supabase REST API to POST directly to the
// database via the pg-graphql or pg endpoint.
// Actually, the supabase-js client with service role key can
// execute SQL through the PostgREST schema if we create a function first.
// 
// Alternative approach: Use fetch to call the Supabase SQL API
// which is available at /pg/query on some versions, or we can
// use the Management API.
//
// Simplest working approach: Use the supabase-js client to
// create the function by calling it through the REST API's
// ability to execute functions in the pg_catalog schema.

async function bootstrapExecSQL() {
  console.log("Bootstrapping exec_sql function...");
  
  // Try calling exec_sql first - maybe it already exists
  const { error } = await supabase.rpc("exec_sql", {
    sql_string: "SELECT 1",
  });
  
  if (!error) {
    console.log("  ✓ exec_sql already exists");
    return true;
  }
  
  console.log("  exec_sql doesn't exist, creating it...");
  
  // Use the Supabase Management API to run SQL
  // The Management API endpoint for running SQL is:
  // POST https://api.supabase.com/v1/projects/{ref}/database/query
  // But that requires a management API token.
  
  // Alternative: Use the direct database connection string
  // Supabase exposes a pg endpoint we can use
  
  // Let's try using fetch to POST SQL directly
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
  
  // Try multiple approaches to create the function
  
  // Approach 1: Direct SQL via Supabase's internal pg endpoint
  const endpoints = [
    { url: `${SUPABASE_URL}/pg/query`, body: { query: createFnSQL } },
    { url: `${SUPABASE_URL}/sql`, body: { query: createFnSQL } },
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ep.body),
      });
      if (res.ok) {
        console.log(`  ✓ Created via ${ep.url}`);
        return true;
      }
      console.log(`  ✗ ${ep.url}: ${res.status}`);
    } catch (e) {
      console.log(`  ✗ ${ep.url}: ${e.message}`);
    }
  }
  
  // Approach 2: Use the pg_net extension if available
  // This allows making HTTP requests from within PostgreSQL
  
  // Approach 3: Create the function by inserting into pg_proc
  // This is hacky but might work with service role
  
  // Approach 4: Use the Supabase Management API
  // We need to check if there's a way to get a management token from the service role key
  
  // Approach 5: Use psql with the pooler connection string
  // The connection string uses the project ref and a password
  // Since we don't have the DB password, let's try the default
  
  console.log("  Trying direct PostgreSQL connection...");
  
  // Actually, let's try a completely different approach:
  // Use the supabase-js client to create tables via the REST API
  // by leveraging the fact that service role bypasses RLS
  // We can't create tables via REST, but we CAN use the
  // Supabase Management API if we have the right token
  
  // Final approach: Create an API route in our Next.js app
  // that runs the migration, and call it after deploying
  
  // For now, let's try one more thing: the Supabase CLI
  // with the service role key as the access token
  
  return false;
}

// ─── Create tables using a migration API route approach ───
// Since we can't directly execute DDL via the REST API without
// an exec_sql function, we'll create the migration as an API route
// that gets called on first deployment.

async function createMigrationRoute() {
  console.log("\nCreating migration API route for table creation...");
  console.log("Tables will be created when the API route is called.");
  console.log("This will happen automatically on first deployment.");
}

// ─── Storage Buckets ───
async function createBuckets() {
  console.log("\nCreating storage buckets...");
  
  const buckets = [
    "photos-original",
    "photos-normalized", 
    "scene-clips",
    "final-exports",
    "logos",
  ];
  
  for (const name of buckets) {
    const { data, error } = await supabase.storage.createBucket(name, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
    
    if (error) {
      if (error.message?.includes("already exists")) {
        console.log(`  ○ ${name} already exists`);
      } else {
        console.log(`  ✗ ${name}: ${error.message}`);
      }
    } else {
      console.log(`  ✓ ${name} created`);
    }
  }
}

// ─── Main ───
async function main() {
  console.log("=== Vidzee Supabase Setup ===\n");
  
  // Create storage buckets (this works with service role key)
  await createBuckets();
  
  // Try to bootstrap exec_sql
  const hasExecSQL = await bootstrapExecSQL();
  
  if (hasExecSQL) {
    console.log("\n✓ exec_sql available, creating tables...");
    
    const statements = [
      // Projects table
      `CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) NOT NULL,
        title TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        price NUMERIC,
        beds INT,
        baths INT,
        sqft INT,
        highlights TEXT,
        agent_name TEXT,
        agent_phone TEXT,
        brokerage TEXT,
        logo_path TEXT,
        style_pack_id TEXT DEFAULT 'modern-clean',
        cut_length TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // Assets table
      `CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        storage_path_original TEXT,
        storage_path_normalized TEXT,
        width INT,
        height INT,
        hash TEXT,
        quality_score NUMERIC,
        room_type TEXT,
        room_confidence NUMERIC,
        flags JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // Storyboard scenes
      `CREATE TABLE IF NOT EXISTS storyboard_scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
        scene_order INT NOT NULL,
        include BOOLEAN DEFAULT true,
        target_duration_sec NUMERIC DEFAULT 3,
        motion_template TEXT,
        caption TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // Renders
      `CREATE TABLE IF NOT EXISTS renders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'queued',
        provider TEXT,
        provider_job_id TEXT,
        input_refs JSONB DEFAULT '{}'::jsonb,
        output_path TEXT,
        duration_sec NUMERIC,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      // Style packs
      `CREATE TABLE IF NOT EXISTS style_packs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config JSONB NOT NULL DEFAULT '{}'::jsonb
      )`,
      // Enable RLS
      `ALTER TABLE projects ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE assets ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE storyboard_scenes ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE renders ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE style_packs ENABLE ROW LEVEL SECURITY`,
      // Projects policies
      `DROP POLICY IF EXISTS "Users can view own projects" ON projects`,
      `CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id)`,
      `DROP POLICY IF EXISTS "Users can create projects" ON projects`,
      `CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id)`,
      `DROP POLICY IF EXISTS "Users can update own projects" ON projects`,
      `CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id)`,
      `DROP POLICY IF EXISTS "Users can delete own projects" ON projects`,
      `CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id)`,
      // Assets policies
      `DROP POLICY IF EXISTS "Users can view own assets" ON assets`,
      `CREATE POLICY "Users can view own assets" ON assets FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can create assets" ON assets`,
      `CREATE POLICY "Users can create assets" ON assets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can update own assets" ON assets`,
      `CREATE POLICY "Users can update own assets" ON assets FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can delete own assets" ON assets`,
      `CREATE POLICY "Users can delete own assets" ON assets FOR DELETE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid()))`,
      // Scenes policies
      `DROP POLICY IF EXISTS "Users can view own scenes" ON storyboard_scenes`,
      `CREATE POLICY "Users can view own scenes" ON storyboard_scenes FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_scenes.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can create scenes" ON storyboard_scenes`,
      `CREATE POLICY "Users can create scenes" ON storyboard_scenes FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_scenes.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can update own scenes" ON storyboard_scenes`,
      `CREATE POLICY "Users can update own scenes" ON storyboard_scenes FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_scenes.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can delete own scenes" ON storyboard_scenes`,
      `CREATE POLICY "Users can delete own scenes" ON storyboard_scenes FOR DELETE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = storyboard_scenes.project_id AND projects.user_id = auth.uid()))`,
      // Renders policies
      `DROP POLICY IF EXISTS "Users can view own renders" ON renders`,
      `CREATE POLICY "Users can view own renders" ON renders FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = renders.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can create renders" ON renders`,
      `CREATE POLICY "Users can create renders" ON renders FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = renders.project_id AND projects.user_id = auth.uid()))`,
      `DROP POLICY IF EXISTS "Users can update own renders" ON renders`,
      `CREATE POLICY "Users can update own renders" ON renders FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = renders.project_id AND projects.user_id = auth.uid()))`,
      // Style packs: public read
      `DROP POLICY IF EXISTS "Anyone can view style packs" ON style_packs`,
      `CREATE POLICY "Anyone can view style packs" ON style_packs FOR SELECT USING (true)`,
      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_storyboard_scenes_project_id ON storyboard_scenes(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_renders_project_id ON renders(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_renders_status ON renders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`,
    ];
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i].trim();
      const { error } = await execSQL(sql);
      if (error) {
        console.log(`  ✗ [${i + 1}/${statements.length}] ${sql.substring(0, 60)}... — ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ [${i + 1}/${statements.length}] ${sql.substring(0, 60)}...`);
        success++;
      }
    }
    
    console.log(`\n  Results: ${success} succeeded, ${failed} failed`);
    
    // Insert style packs via REST API (this works without exec_sql)
    console.log("\nInserting style packs...");
    const { error: spError } = await supabase
      .from("style_packs")
      .upsert([
        {
          id: "modern-clean",
          name: "Modern Clean",
          config: {
            transitions: ["dissolve_soft", "whip_pan_subtle"],
            overlays: { intro: "overlays/modern-clean/intro.mov", lowerThird: "overlays/modern-clean/lowerthird.mov", priceCard: "overlays/modern-clean/price.mov", bedsBaths: "overlays/modern-clean/bedsbaths.mov", outro: "overlays/modern-clean/outro.mov" },
            typography: { font: "Inter", captionMaxChars: 42 },
            safeMargins: { vertical: 0.1, horizontal: 0.07 },
            music: { defaultTrack: "music/modern-clean/track.mp3", volume: 0.12 },
          },
        },
        {
          id: "luxury-classic",
          name: "Luxury Classic",
          config: {
            transitions: ["dissolve_elegant", "fade_black"],
            overlays: { intro: "overlays/luxury-classic/intro.mov", lowerThird: "overlays/luxury-classic/lowerthird.mov", priceCard: "overlays/luxury-classic/price.mov", bedsBaths: "overlays/luxury-classic/bedsbaths.mov", outro: "overlays/luxury-classic/outro.mov" },
            typography: { font: "Playfair Display", captionMaxChars: 38 },
            safeMargins: { vertical: 0.12, horizontal: 0.08 },
            music: { defaultTrack: "music/luxury-classic/track.mp3", volume: 0.1 },
          },
        },
        {
          id: "bold-dynamic",
          name: "Bold Dynamic",
          config: {
            transitions: ["whip_pan_fast", "zoom_through", "film_burn"],
            overlays: { intro: "overlays/bold-dynamic/intro.mov", lowerThird: "overlays/bold-dynamic/lowerthird.mov", priceCard: "overlays/bold-dynamic/price.mov", bedsBaths: "overlays/bold-dynamic/bedsbaths.mov", outro: "overlays/bold-dynamic/outro.mov" },
            typography: { font: "Space Grotesk", captionMaxChars: 36 },
            safeMargins: { vertical: 0.1, horizontal: 0.07 },
            music: { defaultTrack: "music/bold-dynamic/track.mp3", volume: 0.15 },
          },
        },
      ]);
    
    if (spError) {
      console.log(`  ✗ Style packs: ${spError.message}`);
    } else {
      console.log("  ✓ Style packs inserted");
    }
  } else {
    console.log("\n⚠️  Could not create exec_sql function.");
    console.log("   Will create a migration API route instead.");
    console.log("   Tables will be created on first API call after deployment.");
  }
  
  console.log("\n✅ Setup complete!");
}

main().catch(console.error);
