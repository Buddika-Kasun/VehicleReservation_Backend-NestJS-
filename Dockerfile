FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads
RUN mkdir -p /tmp/uploads && chmod -R 777 /tmp/uploads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Start with crypto flag for Alpine compatibility
CMD ["node", "--experimental-global-webcrypto", "dist/main.js"]