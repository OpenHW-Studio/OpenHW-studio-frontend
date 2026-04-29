# Build stage
FROM node:20 AS build
WORKDIR /app/frontend

# Copy frontend package files
COPY OpenHW-studio-frontend-danish/package*.json ./

# 1. Copy the emulator into src/emulator first
COPY openhw-studio-emulator-danish ./src/emulator
RUN rm -rf ./src/emulator/node_modules ./src/emulator/dist

# 2. Update package.json to point to the new local path
RUN sed -i 's|"@openhw/emulator": "file:../openhw-studio-emulator-danish"|"@openhw/emulator": "file:./src/emulator"|' package.json

# 3. Install dependencies and force Vite 5
RUN npm install --legacy-peer-deps && \
    npm install vite@5 --save-dev --legacy-peer-deps

# Copy frontend source code
COPY OpenHW-studio-frontend-danish/ .

# Build-time environment variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# We don't need VITE_EMULATOR_PATH anymore because we put it in node_modules

# Build the app
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Custom nginx config to handle SPA routing
RUN printf "server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html index.htm; \n\
        try_files \$uri \$uri/ /index.html; \n\
    } \n\
}" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
