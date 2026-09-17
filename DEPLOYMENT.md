# GCP VM deployment

This deployment runs the complete stack on one Compute Engine VM:

- `exchange.deepanshu.live` -> Caddy -> Next.js frontend
- `exchange.deepanshu.live/api/*` -> Caddy -> Express backend
- `exchange.deepanshu.live/ws` -> Caddy -> WebSocket service
- `exchange-api.deepanshu.live` remains available as a backend-only hostname
- Postgres, Redis, engine, database consumer, and market maker stay private on the Docker network

## 1. Create the VM

Run these commands on a machine with `gcloud` authenticated. Choose a region close to your users.

```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="asia-south1"
export ZONE="asia-south1-a"
export VM_NAME="perp-exchange"

gcloud config set project "$PROJECT_ID"
gcloud services enable compute.googleapis.com

gcloud compute addresses create "${VM_NAME}-ip" --region="$REGION"

gcloud compute firewall-rules create "${VM_NAME}-web" \
  --network=default \
  --allow=tcp:80,tcp:443 \
  --target-tags=perp-web

gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" \
  --machine-type=e2-standard-2 \
  --boot-disk-type=pd-balanced \
  --boot-disk-size=50GB \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --tags=perp-web \
  --address="${VM_NAME}-ip"
```

## 2. Install Docker and deploy

```bash
gcloud compute ssh "$VM_NAME" --zone="$ZONE"

sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo usermod -aG docker "$USER"
newgrp docker

git clone https://github.com/deepanshuliv/PerpatualExchange.git perp-v2
cd perp-v2
cp .env.example .env
```

Edit `.env` and set real values. At minimum, replace `POSTGRES_PASSWORD` and `JWT_SECRET`:

```dotenv
POSTGRES_PASSWORD=generate-a-long-random-password
JWT_SECRET=generate-another-long-random-secret
CORS_ORIGINS=https://exchange.deepanshu.live
NEXT_PUBLIC_API_URL=https://exchange.deepanshu.live/api
NEXT_PUBLIC_WS_URL=wss://exchange.deepanshu.live/ws
```

Create the Cloudflare records in the next section before starting Caddy, so it can issue the origin certificates.

Build the image and apply database migrations:

```bash
docker compose build --pull
docker compose up -d postgres redis
docker compose run --rm db-consumer \
  bunx prisma migrate deploy --config packages/db/prisma.config.ts
docker compose up -d
docker compose ps
```

## 3. Cloudflare DNS

In the Cloudflare zone for `deepanshu.live`, add both records pointing to the VM's reserved external IP:

| Type | Name | Content | First proxy state |
|---|---|---|---|
| A | `exchange` | `<VM_STATIC_IPV4>` | DNS only (grey cloud) |
| A | `exchange-api` | `<VM_STATIC_IPV4>` | DNS only (grey cloud) |

If `deepanshu.live` is not yet a Cloudflare zone, add it to Cloudflare first and change the domain registrar's nameservers to the nameservers Cloudflare gives you.

Verify DNS before waiting for Caddy's certificates:

```bash
dig +short exchange.deepanshu.live
dig +short exchange-api.deepanshu.live
docker compose logs -f caddy
```

Leave the records DNS-only until Caddy has obtained certificates. Then turn on the orange-cloud proxy for both records, set Cloudflare SSL/TLS mode to **Full (strict)**, enable **Always Use HTTPS**, and ensure **WebSockets** is enabled under Network. Caddy stores certificates in the `caddy_data` Docker volume and renews them automatically.

## 4. Verify the deployment

```bash
curl -i https://exchange.deepanshu.live/api/healthz
curl -i https://exchange-api.deepanshu.live/healthz
curl -i https://exchange.deepanshu.live/ticker/mark/BTCUSD
docker compose logs --tail=100 backend ws caddy
```

After changing `NEXT_PUBLIC_*` values, always rebuild the frontend because Next.js embeds those values into the browser bundle:

```bash
docker compose build frontend
docker compose up -d frontend caddy
```

## 5. Updates

```bash
git pull --ff-only
docker compose build --pull
docker compose run --rm db-consumer \
  bunx prisma migrate deploy --config packages/db/prisma.config.ts
docker compose up -d
```

The `/onramp` endpoint currently credits a demo balance; it is not a UPI payment integration. A real UPI flow needs a payment provider, server-side credentials, order creation, signature verification, and webhook reconciliation.

## SSH recovery when port 22 times out

Google Cloud currently reports the VM as running and the public SSH firewall rule as allowed, but the guest may not have a healthy `sshd` listener. IAP is the safest recovery path:

```bash
gcloud compute firewall-rules create exchange-allow-iap-ssh \
  --project=YOUR_GCP_PROJECT_ID \
  --network=default \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:22 \
  --source-ranges=35.235.240.0/20 \
  --target-tags=exchange-backend-ssh

gcloud compute instances add-tags exchange-backend \
  --project=YOUR_GCP_PROJECT_ID \
  --zone=asia-south1-c \
  --tags=exchange-backend-ssh

gcloud compute ssh exchange-backend \
  --project=YOUR_GCP_PROJECT_ID \
  --zone=asia-south1-c \
  --tunnel-through-iap
```

Once connected, inspect and repair the guest:

```bash
sudo systemctl status ssh --no-pager
sudo ss -lntp | grep ':22'
sudo ufw status verbose
sudo ufw allow 22/tcp
sudo systemctl enable --now ssh
free -h
df -h
sudo journalctl -u ssh --no-pager -n 100
```
