import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import Image from "next/image";

export function EmptyForScreens({ text = "Nenhuma informação disponível." }: { text: string | null }) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-2 py-4 flex flex-col gap-6">
        <PixelCard className="mx-auto mt-4 max-w-xl px-2 py-3  ">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Image
              width={250}
              height={250}
              alt="emppty ilustration"
              className="w-30 h-30 rounded-2xl   animate-bounce-slow "
              src="https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/orphan/abab889f-9158-4afa-be83-3889bc5c628f.jpg"
            />
            <p className="font-mono text-sm text-pixel-subtext">{text}</p>
          </div>
        </PixelCard>
      </div>
    </AppLayout>
  );
}
