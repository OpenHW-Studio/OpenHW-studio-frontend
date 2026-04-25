FROM node:20-alpine AS build

WORKDIR /app

COPY openhw-studio-emulator/ ./openhw-studio-emulator/
COPY OpenHW-studio-frontend/ ./OpenHW-studio-frontend/

WORKDIR /app/openhw-studio-emulator
RUN npm install

WORKDIR /app/OpenHW-studio-frontend
RUN npm install

RUN rm -rf /app/OpenHW-studio-frontend/node_modules/@openhw/emulator && \
    ln -sf /app/openhw-studio-emulator /app/OpenHW-studio-frontend/node_modules/@openhw/emulator

ARG VITE_API_BASE_URL
ARG VITE_EXAMPLES_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ADMIN_EMAILS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_EXAMPLES_BASE_URL=$VITE_EXAMPLES_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_ADMIN_EMAILS=$VITE_ADMIN_EMAILS

RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/OpenHW-studio-frontend/dist /usr/share/nginx/html
COPY --from=build /app/OpenHW-studio-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]