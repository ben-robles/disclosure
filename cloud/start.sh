#!/bin/bash
# Runs the Python API, the React server and the gateway. If any one stops, exit so Cloud Run restarts the container.
python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 &
PORT=3000 HOST=127.0.0.1 node /srv/web/server/index.mjs &
node /srv/gateway.mjs &
wait -n
exit 1
