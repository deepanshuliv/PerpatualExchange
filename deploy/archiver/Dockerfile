# Same base as the postgres service, so pg_dump matches the server and the
# layers are shared on disk.
FROM timescale/timescaledb:latest-pg15

RUN apk add --no-cache rclone

COPY archive.sh /usr/local/bin/archive.sh
RUN chmod +x /usr/local/bin/archive.sh

USER postgres
ENTRYPOINT ["/usr/local/bin/archive.sh"]
