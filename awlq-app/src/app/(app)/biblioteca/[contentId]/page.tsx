import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { LibraryItemScreen } from "@/features/library/screens/LibraryItemScreen";
import type { LibraryContentWithUrl } from "@/features/library/types";

const SIGNED_URL_TTL_SECONDS = 3600;

interface Props {
  params: Promise<{ contentId: string }>;
}

/**
 * /biblioteca/[contentId]
 *
 * Server Component. Fetches the content item and generates a signed URL
 * when the item has a storagePath. Increments accessCount atomically.
 * Falls through to Next.js notFound() for unpublished or missing items.
 */
export default async function BibliotecaItemPage({ params }: Props) {
  const { contentId } = await params;

  let content;
  try {
    content = await prisma.libraryContent.update({
      where: { id: contentId, published: true },
      data: { accessCount: { increment: 1 } },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") notFound();
    throw err;
  }

  let signedUrl: string | undefined;
  if (content.storageBucket && content.storagePath) {
    const { data, error } = await supabase.storage
      .from(content.storageBucket)
      .createSignedUrl(content.storagePath, SIGNED_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      signedUrl = data.signedUrl;
    } else {
      console.error("[biblioteca] createSignedUrl failed:", error?.message);
    }
  }

  const contentWithUrl: LibraryContentWithUrl = { ...content, signedUrl };

  return <LibraryItemScreen content={contentWithUrl} />;
}
