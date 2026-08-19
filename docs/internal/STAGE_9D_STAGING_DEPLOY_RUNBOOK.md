# Stage 9D — staging deployment runbook

## Local prerequisite check

```powershell
.\scripts\check-cloud-run-prerequisites.ps1 -ProjectId PROJECT_ID -Region REGION
```

The check is read-only and never reads a secret version. It confirms an active account, project visibility, Native Firestore database and the existence of `mebelflow-openai-api-key`.

## Required external state

- Google Cloud CLI installed and authenticated;
- selected Google Cloud project and billing account;
- Firestore Native database near the chosen Cloud Run region;
- dedicated OpenAI project key stored only in Secret Manager;
- API service account with `roles/datastore.user` and access to that one secret;
- Artifact Registry repository for the container image.

## Deployment acceptance

1. Build the container and scan it for secrets.
2. Deploy the Cloud Run YAML with concrete project, region, image and service-account values.
3. Confirm `/warmup` returns `200` and `billableAiCalls: 0` after scale-to-zero.
4. Force at least two instances and send competing requests for the same session: exactly one reaches the provider.
5. Send competing requests near a low test budget: calls exceeding available reservations are rejected before provider invocation.
6. Run one controlled GPT-5 Mini request, record token usage and calculated KZT cost without logging its text or API key.
7. Confirm Firestore TTL policies and sanitized Cloud Run logs.

No production traffic is authorized by this runbook. Staging deployment changes external Google Cloud state and requires an explicit execution decision.

## Selected pilot resources

- project: `mebelflow-ai-pilot`;
- region: `europe-central2` (Warsaw);
- Firestore: Native `(default)`, delete protection enabled;
- Artifact Registry: `mebelflow`;
- runtime identity: `mebelflow-api@mebelflow-ai-pilot.iam.gserviceaccount.com`;
- secret metadata name: `mebelflow-openai-api-key`;
- image build: root `cloudbuild.yaml`, with `_IMAGE` supplied at submit time.

## Verified result

- private Cloud Run active revision: `mebelflow-api-staging-00005-fqh`;
- warmup: HTTP 200, zero billable AI calls;
- controlled GPT-5 Mini intent: `SET_WALL_WIDTH`, width 3000;
- usage: 407 input tokens, 81 output tokens;
- calculated cost: 0.12 KZT at price version `2026-08-02`;
- two-instance contention: one HTTP 200 and one HTTP 409 `SESSION_REQUEST_IN_PROGRESS`;
- post-test scaling restored to min 0, max 20, concurrency 100;
- Firestore TTL policies: three active collection-group policies;
- public unauthenticated access remains intentionally disabled.

## Stage 9E Turnstile enforcement

- active private revision: `mebelflow-api-staging-00006-6xw`;
- image: `stage9e-20260802-1`;
- tenant/origin: `salamat-mebel-pilot` / `https://salamat-mebel.kz`;
- Cloud Run verifies the single-use token through the stock Spin Worker before rate limiting, budget reservation and GPT;
- accepted proof requires hostname `salamat-mebel.kz` and action `turnstile-spin-v1`;
- warmup remains non-billable; missing and dummy tokens are rejected before provider invocation.

## Public invocation acceptance

- owner approval was received explicitly;
- service IAM grants `roles/run.invoker` to `allUsers` only;
- public warmup: HTTP 200, zero billable AI calls;
- allowed origin plus dummy Turnstile: HTTP 403 `TURNSTILE_REJECTED`;
- foreign origin: HTTP 403 `ORIGIN_NOT_ALLOWED`;
- real-token browser E2E remains pending until the widget is embedded on an allowed hostname.
