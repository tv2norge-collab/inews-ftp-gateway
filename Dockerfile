FROM node:20-alpine
RUN apk add --no-cache tzdata git
COPY . /opt/sofie-inews-gateway
WORKDIR /opt/sofie-inews-gateway
RUN export NODE_ENV=production
RUN corepack enable
RUN yarn workspaces focus --all --production
CMD ["node", "dist/index.js"]
