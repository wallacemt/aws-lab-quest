import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const LEVEL_DEFS = [
  {
    level: 1,
    name: "Recruta",
    prompt:
      "Pixel art badge shield for 'Recruta'. Young adventurer with simple helmet holding a cloud icon. Sky blue and white. 8-bit retro Nintendo style achievement badge.",
  },
  {
    level: 2,
    name: "Cadete",
    prompt:
      "Pixel art badge shield for 'Cadete'. Cadet with training gear, teal and white colors, small AWS logo, stars. 8-bit retro Nintendo style badge.",
  },
  {
    level: 3,
    name: "Explorador",
    prompt:
      "Pixel art badge shield for 'Explorador'. Explorer with map and compass, purple and yellow colors, cloud motifs. 8-bit retro Nintendo style adventure badge.",
  },
  {
    level: 4,
    name: "Especialista",
    prompt:
      "Pixel art badge shield for 'Especialista'. Armored specialist holding circuit board. Red, gold, and AWS orange accents. 8-bit retro expert badge.",
  },
  {
    level: 5,
    name: "Guardião AWS",
    prompt:
      "Pixel art badge shield for 'Guardião AWS'. Guardian warrior protecting a cloud server. AWS orange armor, dark tones. 8-bit retro epic badge.",
  },
  {
    level: 6,
    name: "Lendário",
    prompt:
      "Pixel art badge shield for 'Lendário'. Legendary hero with crown, golden clouds and stars, rainbow colors. 8-bit retro legendary badge.",
  },
];

async function generateBadgeImage(prompt: string): Promise<{ data: Buffer; mimeType: string }> {
  // Pollinations.ai — free, no API key, no auth required
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 9999);
  const url = `https://gen.pollinations.ai/image/${encoded}?model=gptimage&width=512&height=512&seed=${seed}&key=${process.env.POLLINATIONS_API_KEY}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(url)
    const response = await fetch(url);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const mimeType = contentType.split(";")[0].trim();
      return { data: Buffer.from(arrayBuffer), mimeType };
    }
    const errText = await response.text();
    console.log(errText)
    if (attempt === 3) throw new Error(`Pollinations API error (${response.status}) after 3 attempts: ${errText}`);
    console.log(`  Attempt ${attempt} failed (${response.status}), retrying in 5s...`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error("unreachable");
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting badge seed...\n");

  for (const def of LEVEL_DEFS) {
    const existing = await prisma.levelBadge.findUnique({ where: { level: def.level } });
    if (existing) {
      console.log(`Level ${def.level} (${def.name}) — already exists, skipping.`);
      continue;
    }

    console.log(`Generating badge for Level ${def.level}: ${def.name}...`);

    const { data: imageBuffer, mimeType } = await generateBadgeImage(def.prompt);

    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `badges/level-${def.level}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("aws-lab-quest")
      .upload(path, imageBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      throw new Error(`Upload failed for level ${def.level}: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("aws-lab-quest").getPublicUrl(path);

    await prisma.levelBadge.create({
      data: {
        level: def.level,
        name: def.name,
        imageUrl: publicUrlData.publicUrl,
        supabasePath: path,
      },
    });

    console.log(`  ✓ Badge created: ${publicUrlData.publicUrl}`);
    // Small delay to respect API rate limits
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\nSeed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
