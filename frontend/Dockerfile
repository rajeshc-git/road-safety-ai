FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy frontend source files
COPY . .

# Expose the Vite port
EXPOSE 3000

# Start Vite dev server
CMD ["npm", "run", "dev"]
