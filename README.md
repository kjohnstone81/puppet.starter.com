# White-label booking platform

A public booking site plus an owner's admin portal, deployed to Google Cloud Run.
Availability comes from the business owner's Google Calendar, bookings are written
back to it, and the site designs itself: upload a logo and Claude generates the
palette, type pairing, corner style, and landing-page copy from it.

Infrastructure is entirely Terraform. Deployments run through GitHub Actions and
stop for a human to approve after `terraform plan`.

---

## What's here

```
app/                      Next.js 15 application (public site + admin portal + API)
infra/bootstrap/          One-time Terraform: state bucket, deploy identity, WIF
infra/terraform/          The app stack: Cloud Run, Firestore, GCS, secrets, IAM
.github/workflows/ci.yml      lint / typecheck / build / container / terraform validate
.github/workflows/deploy.yml  build -> plan -> MANUAL APPROVAL -> apply
```

### How it fits together

The public site reads services from Firestore and computes free slots by
subtracting the owner's Google Calendar free/busy from their configured opening
hours. A confirmed booking is written to Firestore and pushed to the calendar as
an event with the customer as an attendee, so the customer gets the invitation
and the owner sees it wherever they already look.

One Google OAuth grant does two jobs. It authenticates the owner into `/admin`
(only the address in `ADMIN_EMAIL` is admitted), and its refresh token is what the
server later uses to read free/busy and write events on that same calendar. There
is no second credential to keep in sync.

Every colour, font, and radius on the site resolves to a CSS custom property
generated from the tenant's theme document, so regenerating the theme re-skins
every page without touching a stylesheet.

---

## One-time setup

You need: a GCP project with billing enabled, `gcloud` and `terraform` locally, and
admin rights on this GitHub repository.

### 1. Bootstrap the project

This creates the Terraform state bucket, the service account GitHub Actions
impersonates, and the Workload Identity Federation pool that lets it do so
without a downloadable JSON key.

```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap apply \
  -var project_id=YOUR_PROJECT_ID \
  -var region=europe-west1 \
  -var github_repository=kjohnstone81/puppet.starter.com
```

Keep the outputs — they become GitHub repository variables in step 4.

### 2. Create the Google OAuth client

In the Cloud console under **APIs & Services -> Credentials**, create an OAuth
client of type **Web application**. You'll add the redirect URI after the first
deploy, once the Cloud Run URL exists. Also configure the OAuth consent screen and
add the calendar scopes:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.readonly`

While the consent screen is in "Testing", add the owner's Google account as a test
user, or sign-in will be refused.

### 3. Populate the secrets

Terraform creates the secret *containers* but deliberately never holds the values —
anything passed through tfvars ends up readable in Terraform state. Create the
containers first (the first deploy does this), then add versions:

```bash
PROJECT=YOUR_PROJECT_ID

printf '%s' "YOUR_CLIENT_ID.apps.googleusercontent.com" \
  | gcloud secrets versions add booking-google-oauth-client-id --project=$PROJECT --data-file=-

printf '%s' "GOCSPX-your-client-secret" \
  | gcloud secrets versions add booking-google-oauth-client-secret --project=$PROJECT --data-file=-

openssl rand -base64 48 \
  | gcloud secrets versions add booking-session-secret --project=$PROJECT --data-file=-

printf '%s' "sk-ant-your-key" \
  | gcloud secrets versions add booking-anthropic-api-key --project=$PROJECT --data-file=-
```

Cloud Run reads the `latest` version of each, so rotating a secret is a new version
plus a redeploy — no Terraform change.

### 4. Configure GitHub

Under **Settings -> Secrets and variables -> Actions -> Variables**, add:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | your project id |
| `GCP_REGION` | e.g. `europe-west1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | from the bootstrap output |
| `GCP_DEPLOYER_SA` | from the bootstrap output |
| `TF_STATE_BUCKET` | from the bootstrap output |
| `ADMIN_EMAIL` | the owner's Google account |
| `FIRESTORE_LOCATION` | `eur3`, `nam5`, or a single region |
| `CUSTOM_DOMAIN` | leave empty unless you have one |
| `PUBLIC_BASE_URL` | leave empty unless you have a custom domain |

These are variables, not secrets — none of them is sensitive, and keeping them
visible makes a failed deploy far easier to diagnose.

### 5. Turn on the approval gate

**This step is what makes the deploy pause.** Under
**Settings -> Environments**, create an environment named `production` and add
yourself under **Required reviewers**.

Without it the `apply` job still runs the plan a reviewer would have seen, but it
won't wait for anyone. The workflow cannot enforce this on its own — required
reviewers are repository configuration, by design, so that the thing granting
approval isn't the same thing asking for it.

### 6. Deploy, then close the OAuth loop

Push to `main`. When the run finishes, the apply job's summary prints the service
URL and the exact redirect URI. Add that URI to the OAuth client's **Authorised
redirect URIs**, then visit `/admin` and sign in with the owner account. That first
sign-in stores the calendar refresh token and the site goes live.

---

## The deploy pipeline

```
push to main
   │
   ├─ build    build the container, push to Artifact Registry, pin by digest
   │
   ├─ plan     terraform fmt -check, validate, plan
   │           the full plan is rendered into the run summary
   │           the plan file is uploaded as an artifact
   │
   └─ apply    ⏸  WAITS FOR A REVIEWER (production environment)
               applies the uploaded plan file — not a fresh one
               smoke-tests /api/healthz and reports the URL
```

Two details worth knowing:

**The apply runs the reviewed plan, not a new one.** The plan file is passed from
`plan` to `apply` as an artifact, so what a reviewer reads in the summary is
byte-for-byte what gets applied. Re-planning at apply time would open a window
where state drifts between the review and the change.

**Images deploy by digest, not tag.** The build job resolves the digest it just
pushed and passes that to Terraform, so the revision Cloud Run starts is exactly
the artifact CI built even if a tag moves later.

Deploys are serialised with a concurrency group. A queued run waits rather than
racing; an in-flight apply is never cancelled.

---

## Local development

```bash
cd app
cp .env.example .env.local     # then fill it in
npm install
npm run dev
```

For Firestore and Storage access locally, run `gcloud auth application-default
login` — the client libraries pick those credentials up automatically.

Add `http://localhost:3000/api/auth/callback` to the OAuth client's redirect URIs.
Leave `PUBLIC_BASE_URL` unset and the app derives the redirect URI from the request
origin, which is why localhost and Cloud Run both work without reconfiguration.

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

---

## Admin portal

`/admin`, gated on the Google account in `ADMIN_EMAIL`.

- **Bookings** — upcoming appointments; cancelling withdraws the calendar invite,
  which is what notifies the customer.
- **Services** — name, description, duration, price, currency, display order, and
  whether it's live. Duration drives how long a slot blocks out.
- **Availability** — opening hours per day (several windows per day are fine),
  slot granularity, gap between appointments, minimum notice, and how far ahead
  people can book.
- **Branding** — upload a logo, generate a theme from it, preview both palettes,
  reset to the default.
- **Settings** — business name, contact details, which calendar to book into,
  timezone, and reconnecting Google.

### How the theming works

The logo is uploaded to Cloud Storage, then sent to Claude
(`claude-opus-5`) as an image alongside the business name and any direction you
type. The response comes back through **structured outputs** against a JSON schema,
so it is guaranteed to parse — there is no model-JSON repair path to maintain.

The schema does real work beyond validation:

- fonts are an **enum** of the fifteen families the site actually loads, so the
  model cannot pick something that renders as a fallback;
- radii and letter-spacing are enums, keeping the output on a consistent scale;
- colours are `^#[0-9A-Fa-f]{6}$`, and the field descriptions carry the contrast
  floors (7:1 body, 4.5:1 secondary) that a page customers book on needs.

The prompt asks for the palette to be drawn from colours actually in the mark, for
the typography to match its character, and explicitly steers away from generic
AI-generated aesthetics. Light and dark palettes are generated together.

If Anthropic's safety classifiers decline the request — a 200 with
`stop_reason: "refusal"` rather than an error — the existing theme is kept and the
portal explains what happened.

---

## Data model

```
tenants/{tenantId}                        settings, branding, theme
tenants/{tenantId}/services/{serviceId}
tenants/{tenantId}/bookings/{bookingId}
tenants/{tenantId}/private/google         OAuth refresh token — never served
```

Single-tenant today (`TENANT_ID` defaults to `default`), but keyed so multi-tenant
is a change of identifier rather than a change of shape.

Everything persisted is a UTC instant. The business timezone is used only to decide
which wall-clock windows are bookable and to render times for humans — the timezone
helpers are built on `Intl`, so there's no date library in the dependency tree.

---

## Security notes

- **No long-lived cloud keys.** GitHub authenticates via Workload Identity
  Federation, restricted by an attribute condition to this one repository. There is
  no service-account JSON key to leak.
- **Separate identities.** The Cloud Run runtime service account can read and write
  Firestore documents, its own assets bucket, and its four secrets — nothing else.
  The broader deploy permissions belong to the CI account only.
- **Nothing in the project is world-readable.** The assets bucket keeps public
  access prevention enforced; the logo is streamed through `/api/logo` using the
  runtime service account, so there is no anonymous IAM binding anywhere and the
  logo is served from the site's own domain rather than a `storage.googleapis.com`
  URL — which is also the right behaviour for a white-label product.
- **Sessions** are HTTP-only, `SameSite=Lax`, signed JWTs, re-checked against
  `ADMIN_EMAIL` on every read — so revoking access is an env var change, not a
  session-store purge.
- **OAuth state** is stored in a single-use cookie and compared on callback.
- **Secrets never enter Terraform state.** Terraform manages the containers; values
  are added with `gcloud`.
- **Firestore has delete protection and point-in-time recovery**, and `prevent_destroy`
  so `terraform destroy` can't take the bookings with it.

## Operational notes

- **Double-booking** is guarded by re-checking live free/busy immediately before
  writing, not by trusting the slot grid the customer clicked. Under genuinely
  simultaneous requests for the same slot a narrow race remains; at the volume a
  single-calendar business runs, that is an accepted trade rather than an
  unnoticed gap. Closing it fully needs a Firestore transaction on a per-slot lock
  document.
- **A booking is saved before the calendar event is created.** If the calendar call
  fails the booking still stands and the admin portal marks it "Not synced", rather
  than the customer seeing a failure for something that did happen.
- **Backend calls are time-bounded.** The Google client libraries retry hard on
  credential failures — around 15 seconds before surfacing an error. Page renders
  cap those reads so a misconfiguration degrades to an unbranded page with a clear
  message instead of a hung request.
- **Cold starts.** `min_instances` defaults to 0, so the first request after an
  idle period pays a container start. Set it to 1 if that matters more than the
  idle cost.

## Cost

At low volume this lands within or near the free tiers: Cloud Run scales to zero,
Firestore's free quota covers a small business's bookings comfortably, and the
storage is a handful of logo files. The recurring cost that isn't free-tier is
Anthropic API usage, and that is per theme generation — a few requests in the life
of a site, not per visitor.
