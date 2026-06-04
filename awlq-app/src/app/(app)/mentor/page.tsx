import { MentorScreen } from "@/features/mentor/screens/MentorScreen";
import { LibrarySuggestions } from "@/features/mentor/components/LibrarySuggestions";

/**
 * /mentor — server page wrapper.
 *
 * MentorScreen is a client component (fetches recommendations via SWR-style
 * hook). LibrarySuggestions runs server-side alongside it to inject
 * contextually relevant library items without a client-side waterfall.
 */
export default function MentorPage() {
  return (
    <div className="flex flex-col gap-6">
      <MentorScreen />
      <div className="mx-auto w-full max-w-lg px-4 pb-6">
        <LibrarySuggestions />
      </div>
    </div>
  );
}
