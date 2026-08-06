# visual-asset-library

Validation boundary between the offline SketchUp/glTF toolchain and MebelFlow runtime.

It parses a small catalog candidate and the standard Khronos Validator JSON report, applies versioned project limits, and returns either an `accepted` catalog entry or explicit rejection reasons. It does not export, optimize, upload, hash, or render GLB files.

The current slice validates declared SHA-256 syntax. Byte-level checksum verification belongs to the backend ingestion adapter before object storage.
