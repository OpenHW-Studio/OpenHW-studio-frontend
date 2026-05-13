# Build stage
FROM node:20 AS build
WORKDIR /app/frontend

# Copy frontend package files
COPY OpenHW-studio-frontend/package*.json ./

# 1. Copy the emulator into src/emulator first
COPY openhw-studio-emulator ./src/emulator
RUN rm -rf ./src/emulator/node_modules ./src/emulator/dist

# 2. Update package.json to point to the new local path
RUN sed -i 's|"@openhw/emulator": "file:../openhw-studio-emulator"|"@openhw/emulator": "file:./src/emulator"|' package.json

# 3. Install dependencies and native binaries for Linux
RUN npm install --legacy-peer-deps && \
    npm install --no-save @rollup/rollup-linux-x64-gnu lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu

# Copy frontend source code
COPY OpenHW-studio-frontend/ .

# Build-time environment variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_EXAMPLES_BASE_URL
ENV VITE_EXAMPLES_BASE_URL=$VITE_EXAMPLES_BASE_URL

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_ADMIN_EMAILS
ENV VITE_ADMIN_EMAILS=$VITE_ADMIN_EMAILS

# Build the app
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Build documentation
WORKDIR /app/docs
COPY openhw-studio-docs/package*.json ./
RUN npm install
COPY openhw-studio-docs/ .
RUN npm run docs:build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY --from=build /app/docs/.vitepress/dist /usr/share/nginx/html/docs

# Custom nginx config to handle SPA routing and Reverse Proxy
COPY OpenHW-studio-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
