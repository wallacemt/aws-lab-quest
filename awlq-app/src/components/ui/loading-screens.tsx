import { RetroIcon } from "./retro-loading";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";

export function LoadingForScreens({ text = "Carregando conteudo..." }: { text: string }) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-2 py-4 flex flex-col gap-6">
        <PixelCard className="mx-auto mt-4 max-w-xl px-2 py-3">
          <div className="flex  flex-col justify-center items-center py-4">
            <RetroIcon />
            <p className="font-mono text-sm text-primary animate-float">{text}</p>
          </div>
        </PixelCard>
      </div>
    </AppLayout>
  );
}
