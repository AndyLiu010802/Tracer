FROM node:24-bookworm-slim
WORKDIR /app
COPY ai-service ./ai-service
COPY public/ai-planner.js ./public/ai-planner.js
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data NODE_ENV=production
EXPOSE 8787
CMD ["node", "ai-service/server.js"]
