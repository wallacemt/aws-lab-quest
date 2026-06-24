import { ReleaseCard } from "./ReleaseCard";

type Entry = {
  id: string;
  category: string;
  text: string;
};

type Release = {
  id: string;
  tagName: string;
  name: string | null;
  bodyMarkdown: string | null;
  adminSummary: string | null;
  highlight: boolean;
  releasedAt: string | null;
  entries: Entry[];
};

type Props = {
  releases: Release[];
};

export function ChangelogList({ releases }: Props) {
  if (releases.length === 0) {
    return (
      <div className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-6 text-center">
        <p className="font-mono text-xs text-[var(--pixel-subtext)]">Nenhuma release publicada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {releases.map((release) => (
        <ReleaseCard key={release.id} release={release} />
      ))}
    </div>
  );
}
