# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS dev
WORKDIR /workspace
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN --mount=type=cache,target=/home/node/.npm npm ci --prefer-offline --no-audit --no-fund
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
