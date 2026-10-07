FROM oven/bun:1.4.2-alpine

# Set working directory
WORKDIR /app

# Copy package configuration files and lockfiles
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies using Bun 1.4.2
RUN bun install

# Copy frontend source files
COPY . .

# Build optimized production bundle
RUN bun run build

# Expose the frontend port
EXPOSE 3000

# Start optimized production server via Bun
CMD ["bun", "run", "start", "--host", "0.0.0.0"]
