# Reproducible development image. Production is a static build served by
# GitHub Pages — this image is for local development, tests and builds only.
FROM node:24-bookworm-slim

WORKDIR /app
ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 5173
# `docker compose run --rm app <script>` runs any npm script (test, build, lint…).
ENTRYPOINT ["npm", "run"]
CMD ["dev", "--", "--host", "0.0.0.0"]
