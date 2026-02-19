/**
 * AI Storyboard & Edit Plan Generation
 *
 * Primary: gemini-2.5-flash with VISION (via OPENAI_API_KEY + OPENAI_BASE_URL)
 * Fallback: gpt-4.1-mini (text-only, via same endpoint)
 * Legacy fallback: Kimi K2.5 (moonshot-v1-128k) if KIMI_API_KEY is valid
 *
 * Structured JSON output with Zod validation.
 */

import { z } from "zod";

// ─── Configuration ──────────────────────────────────────────────────────────

// OpenAI-compatible endpoint (pre-configured in sandbox / Vercel env)
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ??
  process.env.OPENAI_API_BASE ??
  "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// Vision model for storyboard generation (can actually see images)
const VISION_MODEL = "gemini-2.5-flash";
// Text-only fallback
const TEXT_MODEL = "gpt-4.1-mini";

// Kimi (kept for reference; will only be used if OPENAI_API_KEY is not set)
const KIMI_BASE_URL = process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1";
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_MODEL = "moonshot-v1-128k";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const RoomTagSchema = z.object({
  asset_id: z.string(),
  room_type: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string(),
});

export const StoryboardSceneSchema = z.object({
  asset_id: z.string(),
  scene_order: z.number().int().positive(),
  caption: z.string(),
  motion_template: z.enum([
    "push_in",
    "pan_left",
    "pan_right",
    "tilt_up",
    "tilt_down",
  ]),
  target_duration_sec: z.number().min(2).max(10).default(3),
});

export const StoryboardResponseSchema = z.object({
  room_tags: z.array(RoomTagSchema),
  scenes: z.array(StoryboardSceneSchema),
  narrative_arc: z.string(),
});

export const EditSegmentSchema = z.object({
  scene_order: z.number().int().positive(),
  clip_id: z.string(),
  start_sec: z.number().min(0),
  end_sec: z.number().min(0),
  transition: z.string(),
  overlay_type: z.string().optional(),
  overlay_text: z.string().optional(),
});

export const EditPlanSchema = z.object({
  segments: z.array(EditSegmentSchema),
  total_duration_sec: z.number(),
  music_track: z.string().optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoomTag = z.infer<typeof RoomTagSchema>;
export type StoryboardSceneOutput = z.infer<typeof StoryboardSceneSchema>;
export type StoryboardResponse = z.infer<typeof StoryboardResponseSchema>;
export type EditSegment = z.infer<typeof EditSegmentSchema>;
export type EditPlan = z.infer<typeof EditPlanSchema>;

// ─── Walkthrough Order for Validation ───────────────────────────────────────

/**
 * Canonical walkthrough order for real estate video tours.
 * Lower number = earlier in the tour.
 */
const WALKTHROUGH_ORDER: Record<string, number> = {
  aerial: 1,
  exterior: 2,
  front: 3,
  entry: 4,
  foyer: 5,
  hallway: 6,
  living_room: 7,
  great_room: 8,
  family_room: 9,
  dining_room: 10,
  kitchen: 11,
  primary_suite: 12,
  primary_bedroom: 13,
  primary_bathroom: 14,
  bedroom: 15,
  bathroom: 16,
  office: 17,
  study: 18,
  bonus_room: 19,
  laundry: 20,
  laundry_room: 21,
  utility: 22,
  mudroom: 23,
  basement: 24,
  garage: 25,
  patio: 26,
  deck: 27,
  backyard: 28,
  pool: 29,
  garden: 30,
};

function getWalkthroughPriority(roomType: string): number {
  const key = roomType.toLowerCase().replace(/\s+/g, "_").trim();
  if (WALKTHROUGH_ORDER[key] !== undefined) return WALKTHROUGH_ORDER[key];
  // Partial match fallback
  for (const [k, v] of Object.entries(WALKTHROUGH_ORDER)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return 50; // Unknown rooms go near the end
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/** Content part for multimodal messages */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

/** Chat message supporting both string and multimodal content */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call the OpenAI-compatible API with vision support.
 * Supports both text-only and multimodal (image) messages.
 */
async function callVisionAI(
  messages: ChatMessage[],
  model: string = VISION_MODEL,
): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error (${model}) ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Empty response from AI API (${model})`);
  }
  return content;
}

/**
 * Call the OpenAI-compatible API (text-only, for non-vision use cases).
 */
async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  return callVisionAI(messages, TEXT_MODEL);
}

/**
 * Call the Kimi API (fallback, only if KIMI_API_KEY is set).
 * Kimi only supports string content, so we convert multimodal messages.
 */
async function callKimi(messages: ChatMessage[]): Promise<string> {
  if (!KIMI_API_KEY) {
    throw new Error("KIMI_API_KEY is not set");
  }

  // Convert multimodal content to text-only for Kimi
  const textMessages = messages.map((msg) => ({
    role: msg.role,
    content:
      typeof msg.content === "string"
        ? msg.content
        : msg.content
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n"),
  }));

  const res = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIMI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: textMessages,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kimi API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Kimi API");
  }
  return content;
}

/**
 * Call AI with automatic fallback chain:
 * 1. Vision model (gemini-2.5-flash) — can see images
 * 2. Text model (gpt-4.1-mini) — text-only fallback
 * 3. Kimi (moonshot-v1-128k) — legacy fallback
 */
async function callAI(messages: ChatMessage[], useVision: boolean = false): Promise<string> {
  if (OPENAI_API_KEY) {
    // Try vision model first if requested
    if (useVision) {
      try {
        return await callVisionAI(messages, VISION_MODEL);
      } catch (err) {
        console.error(`[AI] Vision model (${VISION_MODEL}) failed, trying text model:`, err);
      }
    }

    // Try text model
    try {
      return await callOpenAI(messages);
    } catch (err) {
      console.error(`[AI] Text model (${TEXT_MODEL}) failed, trying Kimi fallback:`, err);
    }
  }

  // Fallback: Kimi
  return callKimi(messages);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate room tags and a storyboard from uploaded photos.
 * Uses vision model to ACTUALLY SEE the photos for accurate room detection.
 */
export async function generateStoryboard(params: {
  assets: Array<{
    id: string;
    room_type?: string | null;
    storage_url: string;
  }>;
  stylePackId: string;
  cutLength: string;
  sceneRange: { min: number; max: number };
  propertyTitle?: string | undefined;
}): Promise<StoryboardResponse> {
  // Build text asset list for reference
  const assetList = params.assets
    .map(
      (a, i) =>
        `Photo ${i + 1}: ID="${a.id}"${a.room_type ? ` | Previously tagged: ${a.room_type}` : ""}`
    )
    .join("\n");

  const systemPrompt = `You are a professional real estate videographer creating a cinematic property tour video. You analyze listing photos and create storyboards that feel like a natural, professional walkthrough — exactly as you would guide a buyer through the home in person.

You MUST respond with valid JSON matching this exact schema:
{
  "room_tags": [{ "asset_id": "uuid", "room_type": "string", "confidence": 0.0-1.0, "description": "string" }],
  "scenes": [{ "asset_id": "uuid", "scene_order": 1, "caption": "string", "motion_template": "push_in|pan_left|pan_right|tilt_up|tilt_down", "target_duration_sec": 3 }],
  "narrative_arc": "string describing the video flow"
}

═══════════════════════════════════════════════════════════════
ROOM IDENTIFICATION — Use these VISUAL CUES to identify each room:
═══════════════════════════════════════════════════════════════

You can SEE each photo. Identify rooms based on what you ACTUALLY SEE in each image. Use these definitive visual cues:

• "aerial" — Bird's-eye / drone shot looking DOWN at the roof, property from above, overhead perspective of the lot
• "exterior" — Outside view of the house: you can see the building facade, front door from outside, driveway, landscaping, siding/brick, garage door from outside, curb view
• "entry" — Small transitional space just inside the front door: console table, coat hooks, front door visible from inside, narrow hallway near entrance, welcome mat
• "living_room" — Primary social room: sofas/couches, coffee table, TV/entertainment center, fireplace, large windows, open seating arrangement. The MAIN gathering space
• "great_room" — Very large open-concept space combining living/dining/kitchen with high/vaulted ceilings, double-height windows
• "family_room" — Secondary casual living space: sectional sofa, TV, casual furniture, often adjacent to kitchen, more informal than living room
• "dining_room" — Dining table with chairs (4+ chairs around a table), chandelier or pendant light above table, buffet/hutch, china cabinet
• "kitchen" — Countertops, cabinets, stove/oven/range, refrigerator, dishwasher, sink, backsplash, island with stools, range hood. If you see appliances and countertops, it is a KITCHEN
• "primary_suite" — The LARGEST bedroom: king/queen bed, spacious, often with sitting area, walk-in closet visible, ensuite bathroom door visible, upscale bedding/decor
• "primary_bathroom" — Upscale bathroom: double vanity, large walk-in shower OR soaking/freestanding tub, premium fixtures, often has both shower AND tub, larger than other bathrooms
• "bedroom" — Secondary bedroom: bed (twin/full/queen), nightstands, dresser, closet, SMALLER than primary suite, simpler decor
• "bathroom" — Standard bathroom: toilet visible, shower/tub combo, single vanity, basic fixtures, smaller than primary bath
• "office" — Desk, office chair, computer/monitor, bookshelves, filing cabinet, task lighting
• "study" — Similar to office but more traditional: built-in bookshelves, reading chair, library feel
• "bonus_room" — Flex/multi-purpose space: game table, media setup, playroom toys, exercise equipment, loft area
• "laundry" — Washer and/or dryer visible, utility sink, folding counter, laundry supplies, ironing board
• "garage" — Concrete floor, garage door (interior view), cars, storage shelving, workbench, tools
• "mudroom" — Between garage/exterior and interior: cubbies, hooks, bench, shoe storage, coat rack
• "basement" — Below-grade: lower ceiling, small/high windows, exposed ductwork possible, walkout door possible
• "pool" — Swimming pool water visible, pool deck, lounge chairs, pool equipment
• "patio" — Ground-level outdoor living: pavers/concrete, outdoor furniture, grill, covered or uncovered, attached to house
• "deck" — Elevated wood/composite platform: railing, outdoor furniture, attached to house, elevated above ground
• "backyard" — Rear yard: lawn/grass, fence, landscaping, play equipment, open green space
• "garden" — Landscaped garden: flower beds, garden paths, water features, mature plantings, ornamental plants

CRITICAL IDENTIFICATION RULES:
- If you see kitchen appliances (stove, refrigerator, dishwasher) or countertops with cabinets → it is "kitchen", NOT "living_room" or "dining_room"
- If you see a bed → it is "bedroom" or "primary_suite" (primary if it's the largest/most luxurious)
- If you see a toilet or shower/tub → it is "bathroom" or "primary_bathroom"
- If you see the house from outside → it is "exterior" (NOT "entry")
- If you see a dining table with chairs as the main feature → it is "dining_room" (NOT "kitchen" or "living_room")
- If you see sofas/couches as the main feature → it is "living_room" or "family_room"
- A photo showing an open-concept space should be tagged by its DOMINANT feature (e.g., if kitchen island is prominent, tag as "kitchen")

═══════════════════════════════════════════════════════════════
SCENE ORDERING — STRICT walkthrough sequence (this is CRITICAL):
═══════════════════════════════════════════════════════════════

You are a professional real estate videographer. Order scenes EXACTLY as you would walk a buyer through the home. This order is NON-NEGOTIABLE:

1. aerial — Drone/bird's-eye establishing shot (if available)
2. exterior — Front of home, curb appeal, facade
3. entry / foyer — Stepping inside the front door
4. living_room / great_room — The main living space
5. dining_room — Formal or informal eating area
6. kitchen — The heart of the home
7. primary_suite — Master/primary bedroom
8. primary_bathroom — Master/primary bath (immediately after primary suite)
9. bedroom — Secondary bedrooms (group all together)
10. bathroom — Secondary bathrooms (group all together)
11. office / study — Home office or study
12. bonus_room — Flex spaces, media rooms
13. laundry — Laundry/utility room
14. mudroom — If present
15. basement — If present
16. garage — Garage interior
17. patio / deck — Outdoor living spaces
18. backyard — Rear yard
19. pool — Pool area
20. garden — Garden/landscaping features
21. aerial (closing) — Final aerial/exterior closing shot (if a second aerial/exterior photo is available)

ORDERING RULES (MUST FOLLOW):
- ALWAYS start with exterior/aerial shots — the viewer approaches the home from outside
- ALWAYS end with outdoor features (patio, backyard, pool, garden) or a closing exterior/aerial shot
- Group related rooms: primary_suite IMMEDIATELY followed by primary_bathroom
- Group all secondary bedrooms together, then all secondary bathrooms together
- The flow must feel like physically walking through the home in one continuous, logical path
- NEVER jump randomly between interior and exterior
- NEVER place kitchen before living room or dining room
- NEVER place outdoor shots (patio, pool, backyard) in the middle of interior rooms

═══════════════════════════════════════════════════════════════
ADDITIONAL RULES:
═══════════════════════════════════════════════════════════════

- Tag EVERY photo with the most accurate room_type from the list above
- The room_type field MUST use the exact snake_case values listed above (e.g., "living_room", "primary_suite", "primary_bathroom")
- Create ${params.sceneRange.min} to ${params.sceneRange.max} scenes for a "${params.cutLength}" cut
- Vary motion templates for visual interest (don't repeat the same motion more than 2 times in a row)
- Recommended motion templates per room type:
  • Exterior/aerial: "pan_left" or "pan_right" (sweeping reveal)
  • Entry/foyer: "push_in" (welcoming forward motion)
  • Living room/great room: "pan_left" or "pan_right" (showcase the space)
  • Kitchen: "pan_right" or "push_in" (follow the countertop line)
  • Dining room: "pan_left" or "pan_right" (reveal the table setting)
  • Bedrooms: "push_in" (intimate, inviting)
  • Bathrooms: "tilt_up" or "push_in" (reveal fixtures)
  • Backyard/pool: "pan_left" or "tilt_down" (reveal the outdoor space)
- Write short, elegant captions suitable for real estate video overlays (e.g., "Sun-Drenched Living Room", "Chef's Kitchen with Quartz Island", "Resort-Style Pool & Patio")
- Style pack: "${params.stylePackId}"
- IMPORTANT: Use the exact asset IDs provided — do not invent new IDs
- If multiple photos show the same room from different angles, pick the BEST angle for the storyboard`;

  // Build multimodal user content with images
  const userContentParts: ContentPart[] = [];

  // Text introduction
  userContentParts.push({
    type: "text",
    text: `Create a storyboard for this property listing${params.propertyTitle ? ` "${params.propertyTitle}"` : ""}.

I am providing ${params.assets.length} listing photos below. LOOK at each photo carefully to identify the room type.

Here are the photos with their asset IDs (use these exact IDs in your response):
${assetList}

The photos are attached below in order. Each photo is labeled with its asset ID.`,
  });

  // Add each photo as an image_url content part
  // For large sets (>20 photos), use "low" detail to stay within token limits
  const imageDetail = params.assets.length > 20 ? "low" : "auto";

  for (const asset of params.assets) {
    // Label each image with its asset ID
    userContentParts.push({
      type: "text",
      text: `[Photo ID: ${asset.id}]`,
    });
    userContentParts.push({
      type: "image_url",
      image_url: {
        url: asset.storage_url,
        detail: imageDetail,
      },
    });
  }

  // Final instruction after all images
  userContentParts.push({
    type: "text",
    text: `Generate a cinematic storyboard with ${params.sceneRange.min}-${params.sceneRange.max} scenes. Every scene must use one of the asset IDs listed above.

REMEMBER: You are a professional real estate videographer. Order the scenes EXACTLY as you would walk a buyer through the home:
1. Start OUTSIDE (aerial/exterior)
2. Enter through the front door (entry/foyer)
3. Flow through main living spaces (living room → dining room → kitchen)
4. Tour bedrooms (primary suite + primary bath first, then secondary bedrooms + baths)
5. Show utility spaces (office, laundry, garage)
6. End OUTSIDE (patio, backyard, pool, garden, closing aerial)

The walkthrough order is the MOST IMPORTANT aspect of this storyboard. A viewer should feel like they are physically walking through the home.`,
  });

  console.log(`[AI] Generating storyboard for ${params.assets.length} assets, style=${params.stylePackId}, cut=${params.cutLength}, using vision model`);

  // Use vision model for storyboard generation (can see images)
  const content = await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContentParts },
    ],
    true, // useVision = true
  );

  // Parse and validate
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${content.substring(0, 200)}`);
  }

  const validated = StoryboardResponseSchema.parse(parsed);

  console.log(`[AI] Storyboard generated: ${validated.scenes.length} scenes, ${validated.room_tags.length} room tags`);

  // ─── Post-processing: Validate and fix walkthrough order ─────────────────
  const roomTagMap = new Map<string, string>();
  for (const tag of validated.room_tags) {
    roomTagMap.set(tag.asset_id, tag.room_type);
  }

  // Check if the AI ordering looks reasonable by comparing to canonical order
  const sceneRoomTypes = validated.scenes.map((s) => {
    const roomType = roomTagMap.get(s.asset_id) ?? "unknown";
    return { ...s, _roomType: roomType, _priority: getWalkthroughPriority(roomType) };
  });

  // Calculate how "out of order" the AI result is
  let inversions = 0;
  for (let i = 0; i < sceneRoomTypes.length - 1; i++) {
    if (sceneRoomTypes[i]!._priority > sceneRoomTypes[i + 1]!._priority + 5) {
      inversions++;
    }
  }

  const inversionRatio = inversions / Math.max(sceneRoomTypes.length - 1, 1);
  console.log(`[AI] Walkthrough order check: ${inversions} inversions out of ${sceneRoomTypes.length - 1} pairs (ratio: ${inversionRatio.toFixed(2)})`);

  // If more than 30% of transitions are out of order, re-sort by walkthrough priority
  if (inversionRatio > 0.3) {
    console.log("[AI] Re-sorting scenes by canonical walkthrough order (AI ordering was poor)");
    sceneRoomTypes.sort((a, b) => a._priority - b._priority);

    // Re-assign scene_order
    for (let i = 0; i < sceneRoomTypes.length; i++) {
      sceneRoomTypes[i]!.scene_order = i + 1;
    }

    // Rebuild validated scenes without the internal fields
    validated.scenes = sceneRoomTypes.map(({ _roomType: _rt, _priority: _p, ...scene }) => scene);
  }

  return validated;
}

/**
 * Generate an edit plan for assembling the final video from clips.
 */
export async function generateEditPlan(params: {
  scenes: Array<{
    scene_order: number;
    clip_id: string;
    duration_sec: number;
    caption?: string | null;
    room_type?: string | null;
  }>;
  stylePackId: string;
  propertyInfo: {
    title?: string | null;
    address?: string | null;
    price?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    agent_name?: string | null;
    brokerage?: string | null;
  };
}): Promise<EditPlan> {
  const sceneList = params.scenes
    .map(
      (s) =>
        `Scene ${s.scene_order}: clip_id=${s.clip_id}, duration=${s.duration_sec}s, caption="${s.caption ?? ""}", room=${s.room_type ?? "unknown"}`
    )
    .join("\n");

  const propertyDetails = [
    params.propertyInfo.title && `Title: ${params.propertyInfo.title}`,
    params.propertyInfo.address && `Address: ${params.propertyInfo.address}`,
    params.propertyInfo.price &&
      `Price: $${params.propertyInfo.price.toLocaleString()}`,
    params.propertyInfo.beds && `Beds: ${params.propertyInfo.beds}`,
    params.propertyInfo.baths && `Baths: ${params.propertyInfo.baths}`,
    params.propertyInfo.sqft &&
      `Sq Ft: ${params.propertyInfo.sqft.toLocaleString()}`,
    params.propertyInfo.agent_name &&
      `Agent: ${params.propertyInfo.agent_name}`,
    params.propertyInfo.brokerage &&
      `Brokerage: ${params.propertyInfo.brokerage}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a professional video editor creating an edit plan for a real estate listing video.

You MUST respond with valid JSON matching this exact schema:
{
  "segments": [{
    "scene_order": 1,
    "clip_id": "uuid",
    "start_sec": 0.0,
    "end_sec": 3.0,
    "transition": "dissolve|cut|whip_pan|fade_black|zoom_through",
    "overlay_type": "none|intro|lower_third|price_card|beds_baths|outro",
    "overlay_text": "optional text for overlay"
  }],
  "total_duration_sec": 45.0,
  "music_track": "ambient_modern"
}

Rules:
- Use the first scene for an intro overlay with the property title/address
- Add a price card overlay early in the video (scene 2-4)
- Add beds/baths overlay in the middle
- Use the last scene for an outro with agent info
- Vary transitions based on the style pack "${params.stylePackId}"
- Keep total duration reasonable (30-90 seconds)`;

  const userPrompt = `Create an edit plan for this property video.

Style Pack: ${params.stylePackId}

Property Details:
${propertyDetails}

Available Clips:
${sceneList}`;

  // Edit plan is text-only (no images needed)
  const content = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${content.substring(0, 200)}`);
  }

  const validated = EditPlanSchema.parse(parsed);

  return validated;
}
