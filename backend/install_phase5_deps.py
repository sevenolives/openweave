#!/usr/bin/env python3
"""
Install Phase 5 dependencies and run initial setup.
"""
import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return None

def main():
    """Main installation process."""
    print("🚀 Installing Phase 5 dependencies for Agent Desk...")
    
    # Change to backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Install dependencies
    if not run_command("pip install -r requirements.txt", "Installing Python dependencies"):
        sys.exit(1)
    
    # Run migrations
    if not run_command("python manage.py makemigrations", "Creating database migrations"):
        sys.exit(1)
    
    if not run_command("python manage.py migrate", "Running database migrations"):
        sys.exit(1)
    
    # Collect static files
    if not run_command("python manage.py collectstatic --noinput", "Collecting static files"):
        sys.exit(1)
    
    # Run tests
    print("🧪 Running test suite...")
    if not run_command("python manage.py test tickets", "Running tests"):
        print("⚠️ Some tests failed, but continuing...")
    
    # Create superuser if needed
    print("👤 Creating superuser (if needed)...")
    run_command("python manage.py createsuperadmin", "Creating superuser")
    
    # Seed data
    print("📊 Seeding initial data...")
    run_command("python manage.py seed", "Seeding database")
    
    print("\n🎉 Phase 5 installation completed!")
    print("📖 API Documentation available at: /api/docs/")
    print("🔍 Search and filtering enabled on all list endpoints")
    print("🔒 Rate limiting configured (100/day anonymous, 1000/day authenticated)")
    print("📄 Comprehensive test suite available")
    print("🚀 Production-ready deployment configuration updated")

if __name__ == "__main__":
    main()