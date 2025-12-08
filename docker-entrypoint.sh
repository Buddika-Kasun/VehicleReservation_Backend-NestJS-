#!/bin/sh

# Run migrations
echo "Running database migrations..."
if [ "$NODE_ENV" = "production" ]; then
    npm run migration:run
    if [ $? -ne 0 ]; then
        echo "Migration failed!"
        exit 1
    fi
    echo "Migrations completed successfully"
fi

# Start the application
echo "Starting NestJS application..."
exec node dist/main.js