import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function QuoteButton({ pro }: { pro: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="touch"
        className="w-full"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
      >
        Get a quote: {pro}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[430px] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-xl">Recommended: {pro}</SheetTitle>
            <SheetDescription>Demo only. No request is actually sent.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6" aria-live="polite">
            {sent ? (
              <p className="rounded-lg bg-secondary p-4 text-lg font-semibold text-secondary-foreground">
                Request sent (demo)
              </p>
            ) : (
              <Button size="xl" onClick={() => setSent(true)}>
                Request quote
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
