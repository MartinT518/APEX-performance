#!/bin/bash
# Quick setup script to create .env.local from template

if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Skipping..."
    exit 0
fi

echo "📝 Creating .env.local from template..."
cat > .env.local << 'EOF'
# ============================================
# APEX Performance - Environment Variables
# ============================================
# Fill in your actual values below

# Supabase Configuration
# Get these from: https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# New API Key Format (2025+) - Recommended
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key-here

# Legacy format (still supported)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Secret key for server-side operations (keep secret!)
# New format: SUPABASE_SECRET_DEFAULT_KEY
SUPABASE_SECRET_DEFAULT_KEY=your-secret-key-here
# Legacy format: SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Garmin Connect (Optional - for data ingestion)
GARMIN_EMAIL=your-email@example.com
GARMIN_PASSWORD=your-password-here
EOF

echo "✅ Created .env.local"
echo "📋 Please edit .env.local and fill in your actual credentials"
echo "📖 See ENV_TEMPLATE.md for detailed documentation"

