FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global npm@11.6.2
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/voting-domain/package.json packages/voting-domain/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production SERVE_WEB=true API_HOST=0.0.0.0 API_PORT=3001
WORKDIR /app
RUN npm install --global npm@11.6.2
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/packages/voting-domain/package.json packages/voting-domain/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/src/db/migrations apps/api/dist/migrations
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/deploy/supabase-root.crt deploy/supabase-root.crt
COPY --from=build --chmod=755 /app/deploy/start-test.sh deploy/start-test.sh
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
