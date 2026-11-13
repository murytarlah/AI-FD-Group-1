import Link from "next/link";

export default function NoteNotFound() {
  return <main className="mx-auto max-w-lg px-4 py-10">
    <h1 className="text-2xl font-bold">Not Found</h1>
    <p className="mt-4">This note is not available.</p>
    <Link href="/" prefetch={false} className="mt-6 inline-block underline">Back to My Notes</Link>
  </main>;
}
