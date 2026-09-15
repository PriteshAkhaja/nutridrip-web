"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} size="lg">
      Print / save as PDF
    </Button>
  );
}
