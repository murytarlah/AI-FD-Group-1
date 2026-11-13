"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg p-6">
    <h1 className="text-2xl font-bold">Something went wrong</h1>
    <p role="alert" className="mt-4">We could not complete that request. Check your connection and try again. If this continues, contact the centre administrator.</p>
    <button onClick={reset} className="mt-5 rounded-lg bg-indigo-700 px-5 py-3 text-white">Try again</button>
    <p className="mt-4"><a href="/login" className="underline">Return to login</a></p>
  </main>;
}
