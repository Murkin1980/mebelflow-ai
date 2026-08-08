# Transcription Gateway

Server-side Stage 9 gateway for browser-recorded voice commands.

It validates the request and audio contract, verifies Turnstile before provider access, shares tenant RPM/idempotency and budget coordination with the intent gateway, reserves cost before transcription, refunds failed calls, and commits actual token usage to a separate `stt_` session ledger.

The browser never receives provider credentials or controls the model and pricing snapshot.
