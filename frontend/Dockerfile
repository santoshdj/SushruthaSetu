FROM node:20-alpine AS builder
WORKDIR /app
# Copy manifests first for layer-cache efficiency
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# These are baked into the JS bundle at build time by Vite.
# Railway must supply them as Build Variables on the frontend service.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
# gettext provides envsubst for runtime PORT injection
RUN apk add --no-cache gettext
COPY --from=builder /app/dist /usr/share/nginx/html
# Store as a template; entrypoint substitutes $PORT before nginx starts
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
# Railway injects $PORT; fall back to 80 for local docker-compose
CMD ["/bin/sh", "-c", "export PORT=${PORT:-80} && envsubst '$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
