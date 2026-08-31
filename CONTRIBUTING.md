# Contributing

Thanks for helping grow this prompt library! 🎨

## How to add a prompt

1. **Fork & branch.**
2. **Add your entry to `prompts.json`** (the single source of truth — never
   edit `README.md` or `docs/` by hand, they are generated):

   ```json
   {
     "id": "your-unique-slug",
     "title_en": "Short English Title",
     "title_zh": "简短中文标题",
     "category": "portrait",
     "tags": ["portrait", "cinematic"],
     "aspectRatio": "3:4",
     "prompt": "Full prompt text (long-form, descriptive)…",
     "prompt_en": "Optional English version…",
     "source": "original",
     "featured": false,
     "generate": false,
     "image": null
   }
   ```

3. **Attach a preview image** (optional but recommended):
   compress to WebP ≤ 640px on the long side, under 100 KB, and put it under
   `images/<category>/<id>.webp`, then set `"image": "images/<category>/<id>.webp"`.
4. **Run the build** and commit everything it regenerates:

   ```bash
   node ../template/scripts/build.mjs   # from the repo root
   ```

5. **Open a PR** describing what the prompt produces.

## Quality bar

- **Long-form, descriptive prompts** (50–150 words). Say what the subject,
  style, lighting, composition and mood are — not just a tag list.
- **Original or properly rewritten text.** Do not paste prompts verbatim from
  other galleries, docs or users' posts. Ideas are fine; wording must be yours.
- **Only images you generated yourself.** No copyrighted or third-party
  artwork.
- By submitting, you license your contribution under [CC BY 4.0](LICENSE).

## Categories

See `repo.config.json` for the current category list. Propose new categories
in an issue first.

## Reporting problems

Open an issue, or email support@glmimage.app for takedown requests (see
[NOTICE.md](NOTICE.md)).
