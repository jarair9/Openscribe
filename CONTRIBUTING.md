# Contributing to Openscribe

Thanks for taking the time to contribute! Openscribe is a local-first
whiteboard animation studio, and improvements of every size are welcome.

## Before you start

- Search existing issues for your problem or idea; comment there instead of
  opening a duplicate.
- For substantial changes (new features, architectural work), open an issue
  first and wait for feedback before writing code.

## Development setup

```bash
npm install
npm run dev        # start the app with hot reload
```

Requirements: Node.js 20+ and an internet connection for `npm install`.
Video export needs an FFmpeg binary at `resources/ffmpeg/ffmpeg.exe`
(not tracked in git — download it from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)
and place it there).

## Making changes

1. Branch from `main` (`git checkout -b my-feature`).
2. Keep commits focused; use clear, imperative messages ("Add X", "Fix Y").
3. Run the checks before pushing:

   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

4. Open a pull request against `main`. Fill in the template: what changed,
   why, and how you verified it. Include screenshots or short clips for UI
   changes.

## Code style

- TypeScript strict mode; no `any` unless there is no alternative.
- Match the formatting already present in the file you are editing.
- Renderer state lives in Zustand stores; pure logic (schema, animation,
  geometry) belongs in `src/core` and is covered by Vitest tests.

## Reporting bugs

Use the bug report issue template and include: what happened, what you
expected, steps to reproduce, your OS and app version, and any error output.
Logs can be opened from the app menu and are very helpful.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](LICENSE). Bundled fonts keep their own licenses; see
[fonts/LICENSES.md](fonts/LICENSES.md).
