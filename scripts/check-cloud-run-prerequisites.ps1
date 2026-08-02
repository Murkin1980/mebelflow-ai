param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Region,
  [string]$SecretName = "mebelflow-openai-api-key"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI (gcloud) is not installed or is not on PATH."
}

$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)"
if (-not $activeAccount) { throw "No active gcloud account. Run: gcloud auth login" }

$project = gcloud projects describe $ProjectId --format="value(projectId)"
$firestore = gcloud firestore databases describe --project=$ProjectId --database="(default)" --format="value(type,locationId)"
$secret = gcloud secrets describe $SecretName --project=$ProjectId --format="value(name)"

[pscustomobject]@{
  Account = $activeAccount
  Project = $project
  Region = $Region
  Firestore = $firestore
  OpenAiSecret = $secret
  MutationPerformed = $false
} | Format-List
