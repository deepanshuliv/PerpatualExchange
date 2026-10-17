#!/bin/sh
# Update the perp deployment on the shared VM. Run from /opt/apps/perp.
set -eu
cd "$(dirname "$0")/.."

git pull --ff-only
df -h /

flock /opt/apps/.build.lock \
  docker compose -p perp -f docker-compose.prod.yml up -d --build --remove-orphans

# A rebuild leaves the previous images untagged. Remove only this project's
# (shared VM rule: no global prune).
docker image ls -q --filter dangling=true --filter label=com.docker.compose.project=perp \
  | xargs -r docker image rm || true

docker compose -p perp -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8090/api/healthz
