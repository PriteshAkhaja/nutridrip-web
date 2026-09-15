"use client";

import { Button } from "@/components/ui/Button";

/**
 * Printing is also how a document is downloaded here: every browser's print
 * dialog offers "Save as PDF", which produces the same sheet a PDF library
 * would and leaves nothing extra to keep patched.
 */
export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} size="lg">
      {label}
    </Button>
  );
}
