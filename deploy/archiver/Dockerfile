# Same base as the postgres service, so pg_dump matches the server and the
# layers are shared on disk.
FROM timescale/timescaledb:latest-pg15

RUN apk add --no-cache rclone

COPY archive.sh /usr/local/bin/archive.sh
RUN chmod +x /usr/local/bin/archive.sh

USER postgres
# An empty config file stops rclone logging "config file not found" on every call;
# the remote itself is configured through RCLONE_CONFIG_R2_* variables.
RUN mkdir -p /var/lib/postgresql/.config/rclone \
 && touch /var/lib/postgresql/.config/rclone/rclone.conf
ENTRYPOINT ["/usr/local/bin/archive.sh"]
