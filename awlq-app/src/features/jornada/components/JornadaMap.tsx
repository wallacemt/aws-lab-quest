"use client";

import { JornadaBossNode } from "@/features/jornada/components/JornadaBossNode";
import { JornadaStageNode } from "@/features/jornada/components/JornadaStageNode";

type JourneyNarrative = {
  stageName: string;
  storyText: string;
  awsContext: string;
};

export type JornadaStage = {
  packId: string;
  packName: string;
  difficultyScore: number;
  artworkUrl: string | null;
  questionCount: number;
  stageNumber: number;
  isBoss: boolean;
  completed: boolean;
  narrative: JourneyNarrative;
};

type Props = {
  stages: JornadaStage[];
  currentStageIndex: number;
  onSelectStage: (stage: JornadaStage) => void;
};

export function JornadaMap({ stages, currentStageIndex, onSelectStage }: Props) {
  return (
    <div className="space-y-0">
      {stages.map((stage, index) => {
        const isCurrent = index === currentStageIndex;
        // Fog: stages more than 1 ahead of current progress
        const isFogged = index > currentStageIndex + 1;

        const connector = index < stages.length - 1 && (
          <div className="flex justify-center my-0">
            <div
              className={[
                "w-0.5 h-6 border-l-2",
                stage.completed ? "border-green-500 border-dashed" : "border-[var(--pixel-border)] border-dotted",
              ].join(" ")}
            />
          </div>
        );

        return (
          <div key={stage.packId}>
            {stage.isBoss ? (
              <JornadaBossNode
                stage={stage}
                isCurrent={isCurrent}
                isFogged={isFogged}
                onSelect={onSelectStage}
              />
            ) : (
              <JornadaStageNode
                stage={stage}
                isCurrent={isCurrent}
                isFogged={isFogged}
                onSelect={onSelectStage}
              />
            )}
            {connector}
          </div>
        );
      })}
    </div>
  );
}
