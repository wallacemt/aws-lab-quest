import type { LibraryContent, LibraryContentType } from "@prisma/client";

/**
 * Lightweight projection used in list endpoints.
 * Never includes storagePath, bodyMarkdown, or presigned URLs.
 */
export type LibraryContentLite = {
  id: string;
  type: LibraryContentType;
  title: string;
  description: string | null;
  category: string;
  authorName: string;
  accessCount: number;
};

/** Full content row with an optional presigned URL for file-backed types. */
export type LibraryContentWithUrl = LibraryContent & {
  signedUrl?: string;
};
