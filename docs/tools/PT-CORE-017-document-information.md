# PT-CORE-017 — Document information inspector

`/doc-info/` provides a read-only, in-memory report for one local PDF within the existing 50 MB / 300-page limits. It does not extract page text, render pages, alter the source, generate an output file, ask for a password, verify certificates, or write document information to logs or storage.

## Report contract

- Sanitized filename, actual byte count, parser-reported page count and PDF version.
- Per-page visible dimensions in physical points and millimetres, with intrinsic rotation and UserUnit shown separately. PDF.js's scale-1 viewport incorporates CropBox/MediaBox intersection, nonzero crop origin, rotation and UserUnit. Millimetres use 25.4/72; display rounds only at rendering. Pages are shown in batches of 25; all pages are inspected and counted.
- Standard information-dictionary title, author, subject, keywords, creator, producer, creation date and modification date. If present, common XMP title/creator/description/keywords/dates appear in a separate expandable section, without silently replacing information-dictionary values.
- All metadata is treated as untrusted document-supplied text, displayed by React with wrapping, never interpreted as markup, URLs or commands. Values are bounded to 1,000 characters with explicit truncation; missing fields say Not supplied. Dates remain in their original representation, including timezone information, without inventing a timezone.
- Encryption is reported from PDF.js's `EncryptFilterName`, not a substring guess. The shared early encryption marker check is relaxed **only by explicit opt-in for this read-only inspector**. Every modifying tool keeps its existing early rejection. A parser-confirmed password requirement produces a limited report: bytes/name known, page count/metadata/signatures unavailable. Files that can open without a password can report encryption without claiming they are unencrypted. No decryption/password-entry flow is introduced.
- Signature indicators use PDF.js's public `getSignatures()` metadata plus the document signature flag. Counts mean entries were reported, not that a signature is valid. A flag without signed entries is distinguished from a reported signature; read failures remain unknown. The inspector does not request signature payloads or cryptographic verification, render a signature stamp, or claim a visual mark is a digital signature.
- The report explains that authenticity, trust, certificate expiry and document integrity are not verified, and that modifying a PDF can invalidate signatures. Inspection preserves the original bytes.

Metadata/signature-read failures produce generic warnings with unknown indicators; geometry/read failures do not expose a partial successful report. Raw parser errors and document values are not logged. Inspection loads set PDF.js verbosity to zero on both the main thread and the owned worker; exception messages are converted to the shared error taxonomy rather than shown verbatim.

## Lifecycle

Each inspection owns a cancellable PDF.js worker. The cancellation monitor starts before loading; pending metadata, signature and page requests race an abort signal, and cancellation terminates the worker. Page cleanup and document teardown run on completion/error/cancellation. Job identity and mounted-state guards discard late results. Selecting/replacing/removing a source clears the prior report immediately and cancels the prior job. Retry retains the source; Start over/Clear files/tool exit discard the report and source references. No object URLs, result blobs, localStorage, sessionStorage or IndexedDB are needed.

## Evidence

- Eight unit tests cover exact cropped/rotated/UserUnit geometry, unchanged bytes, sanitized filenames, bounded Unicode metadata and XMP, raw dates, synthetic signature entries versus the F-009 visual marker, parser-confirmed locked input versus a stray Encrypt marker, malformed/301-page rejection, cancellation/retry, unavailable metadata/signature indicators and deterministic cleanup including a held metadata request.
- Ten desktop/mobile browser checks exercise inert script-like metadata, bounds/layout, signature and encryption wording, malformed recovery, bounded page pagination, replacement/reset/exit, storage emptiness, and held metadata/page requests followed by cancel/worker termination and replacement with discarded late output.
- All browser requests are restricted to the test origin/data/blob and uncaught page errors fail tests. Optional screenshots are temporary visual QA evidence, never uploaded by CI.
- Required gates: app/test/e2e TypeScript, lint, all unit tests, production build, full desktop/mobile interface and image-engine regression suites, production dependency audit and corpus CI. No dependencies were added.

Next task: **PT-SEC-001 — Harden rendering and exported filenames**.

CI exposed an existing corpus reproducibility flake: MuPDF's generated trailer IDs can have different encoded lengths, changing a PDF's size by a byte. The reproducibility check now normalizes only final-trailer ID contents (hexadecimal or escaped literal strings) before comparing sizes; content/image sizes, page counts, form fields and rotations remain checked, and explicit page dimensions are additionally compared. Four Python regressions cover ID length variation, real content-size changes, non-PDF/truncated input and geometry differences. Canonical fixtures and their pinned hashes remain unchanged.
