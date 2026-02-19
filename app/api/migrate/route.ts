import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const SQL_STATEMENTS = [
  // Create exec_sql helper function
  `CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
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
   $fn$`,

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

export async function POST(request: Request) {
  // Simple check to prevent accidental runs
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  
  if (secret !== "bootstrap") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: Array<{ index: number; sql: string; status: string; error?: string | undefined }> = [];

  // Try to create the exec_sql function directly first
  // We'll use a special trick: try to use the supabase client to run it
  // Actually, we can't run raw SQL via the client without exec_sql.
  
  // Let's try to create the tables directly via the client for the ones that don't need raw SQL
  // But we really need the DDL.
  
  // If the user has provided the database password, we could use a postgres client.
  // Since we don't have it, we must rely on the dashboard or the management API.
  
  // For now, let's just try to insert the style packs which doesn't need DDL if the table exists
  const { error: spError } = await supabase.from("style_packs").upsert([
    {
      id: "modern-clean",
      name: "Modern Clean",
      config: {
        transitions: ["dissolve_soft", "whip_pan_subtle"],
        typography: { font: "Inter", captionMaxChars: 42 },
        safeMargins: { vertical: 0.1, horizontal: 0.07 },
      },
    },
    {
      id: "luxury-classic",
      name: "Luxury Classic",
      config: {
        transitions: ["dissolve_elegant", "fade_black"],
        typography: { font: "Playfair Display", captionMaxChars: 38 },
        safeMargins: { vertical: 0.12, horizontal: 0.08 },
      },
    },
    {
      id: "bold-dynamic",
      name: "Bold Dynamic",
      config: {
        transitions: ["whip_pan_fast", "zoom_through", "film_burn"],
        typography: { font: "Space Grotesk", captionMaxChars: 36 },
        safeMargins: { vertical: 0.1, horizontal: 0.07 },
      },
    },
  ]);

  results.push({
    index: 0,
    sql: "INSERT style_packs",
    status: spError ? "failed" : "success",
    error: spError?.message ?? undefined,
  });

  return NextResponse.json({
    message: "Migration attempt finished",
    results,
    hint: "If tables don't exist, please run the SQL from build-brief.md in the Supabase SQL Editor.",
  });
}
