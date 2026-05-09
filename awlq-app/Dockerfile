FROM oven/bun:canary-alpine 
WORKDIR /app

COPY package.json tsconfig.json ./
RUN bun install

COPY . .

RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]