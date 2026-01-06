#!/bin/bash

# BugHunt Live - Database Setup Script

echo "🔧 Setting up BugHunt Live database..."

# Database configuration
DB_NAME="bughunt_live"
DB_USER="postgres"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install it first."
    exit 1
fi

# Create database if it doesn't exist
echo "📦 Creating database: $DB_NAME"
psql -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || psql -U $DB_USER -c "CREATE DATABASE $DB_NAME"

# Run schema
echo "📋 Running schema..."
psql -U $DB_USER -d $DB_NAME -f database/schema.sql

echo "✅ Database setup complete!"
echo ""
echo "Database: $DB_NAME"
echo "Schema: Initialized with tables, indexes, and views"
echo ""
echo "Next steps:"
echo "1. Update .env with your database credentials"
echo "2. Run: npm run dev"
