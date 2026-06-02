import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntryForm } from "@/components/entry-form";

export default function NewEntryPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nowy wpis</h1>
        <Button asChild variant="ghost" size="icon" aria-label="Wróć">
          <Link href="/entries">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
      </div>
      <EntryForm />
    </div>
  );
}
