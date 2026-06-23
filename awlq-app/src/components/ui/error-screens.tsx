import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "./pixel-button";
import Image from "next/image";
export function ErrorForScreens({ error = "Ocorreu um erro.", load }: { error: string | null; load: () => void }) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-2 py-4 flex flex-col gap-6">
        <PixelCard className="mx-auto mt-4 max-w-xl px-2 py-3  ">
          <div className="flex flex-col items-center gap-4  ">
            <Image
              width={250}
              height={250}
              alt="error-ilustration"
              className="w-60 h-60 rounded-2xl   animate-bounce-slow "
              src="https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/orphan/46a83d75-f963-426d-9ec3-a75b686d70cc-removebg-preview.png"
            />
            <p className="font-mono text-sm text-red-500">{error}</p>
            <PixelButton variant="ghost" onClick={() => void load()}>
              Tentar novamente
            </PixelButton>
          </div>
        </PixelCard>
      </div>
    </AppLayout>
  );
}
