
'use server';

export async function checkNote(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const rawTags = String(formData.get('tags') ?? '');

  if (!title) {
    return {
      ok: false as const,
      error: 'Please enter a title for your note.',
    };
  }

  if (!body) {
    return {
      ok: false as const,
      error: 'Please write something in your note.',
    };
  }

  const tags = Array.from(
    new Set(
      rawTags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
    )
  );

  return {
    ok: true as const,
    note: { title, body, tags },
  };
}
