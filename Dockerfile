# The Disclosure web app for Cloud Run: React front end + Python API in one container.
# The model lives in a separate private service (cloud/Dockerfile).

# Stage 1: build the React front end as a Node server (the Lovable default targets Cloudflare).
FROM node:22-slim AS web
WORKDIR /web
RUN npm install -g bun@1
COPY frontend/package.json frontend/bun.lock frontend/bunfig.toml ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
ENV NITRO_PRESET=node-server
RUN node node_modules/vite/bin/vite.js build

# Stage 2: Python API + the built front end + a small gateway.
FROM python:3.12-slim
WORKDIR /srv
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
COPY static static
COPY assets assets
COPY --from=web /web/.output web
COPY cloud/gateway.mjs cloud/start.sh ./
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh
# Cloud Run only lets /tmp be written. Sessions are lost when the instance restarts.
ENV DISCLOSURE_DATA_DIR=/tmp/disclosure \
    PYTHONUNBUFFERED=1
RUN useradd --create-home appuser
USER appuser
CMD ["/bin/bash", "/srv/start.sh"]
