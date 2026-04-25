"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Eye, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTripProofViewUrl } from "@/lib/api/portal-trips";

interface Props {
  tripId: string;
  objectKey: string;
  label: string;
}

function isPdfKey(key: string): boolean {
  const ext = key.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  return ext === "pdf";
}

export function SignedDocPreview({ tripId, objectKey, label }: Props) {
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["proof-view-url", tripId, objectKey] as const,
    queryFn: () => getTripProofViewUrl(tripId, objectKey),
    enabled: open,
    staleTime: 4 * 60_000,
    gcTime: 15 * 60_000,
  });

  const isPdf = isPdfKey(objectKey);
  const viewUrl = query.data?.viewUrl ?? null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Eye className="size-3.5" /> View
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base">{label}</DialogTitle>
          </DialogHeader>

          {query.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : query.isError || !viewUrl ? (
            <div className="py-12 text-center text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : "Unable to load document"}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              {isPdf ? (
                <iframe
                  src={viewUrl}
                  title={label}
                  className="h-[70vh] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewUrl}
                  alt={label}
                  className="mx-auto max-h-[70vh] w-auto object-contain"
                />
              )}
            </div>
          )}

          {viewUrl ? (
            <div className="flex items-center justify-end gap-2">
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" /> Open in new tab
                </a>
              </Button>
              <Button asChild size="sm" className="h-8 text-xs">
                <a href={viewUrl} download>
                  <Download className="size-3.5" /> Download
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
