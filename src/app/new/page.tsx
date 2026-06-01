import { EntryForm } from "@/components/entry-form";

export default function NewEntryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nowy wpis</h1>
      <EntryForm />
    </div>
  );
}
