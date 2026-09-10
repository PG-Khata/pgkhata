"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  ownerName: string;
  onExit: () => void;
}

export function ImpersonationBanner({ ownerName, onExit }: Props) {
  return (
    <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <span>
        Viewing as <strong>{ownerName}</strong> — you are impersonating this owner
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onExit}
        className="h-7 text-black hover:bg-amber-600 hover:text-black"
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Exit
      </Button>
    </div>
  );
}
