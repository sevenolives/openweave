#!/usr/bin/env python3
"""
Migration script to add public community fields to Project and Workspace models.
Run this from the backend/ directory.
"""

import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0001_initial'),  # Replace with the actual last migration
    ]

    operations = [
        # Add fields to Project model
        migrations.AddField(
            model_name='project',
            name='url',
            field=models.URLField(blank=True, null=True, help_text="Project website URL"),
        ),
        migrations.AddField(
            model_name='project',
            name='logo',
            field=models.URLField(blank=True, null=True, help_text="Project logo URL"),
        ),
        
        # Add fields to Workspace model  
        migrations.AddField(
            model_name='workspace',
            name='is_public',
            field=models.BooleanField(default=False, help_text="Whether this workspace can be viewed publicly"),
        ),
        migrations.AddField(
            model_name='workspace',
            name='description',
            field=models.TextField(blank=True, default='', help_text="Public description of what this workspace does"),
        ),
    ]

# Alternative: add fields directly to models.py
print("Adding fields directly to models.py...")

# Read current models.py
models_path = 'tickets/models.py'
with open(models_path, 'r') as f:
    content = f.read()

# Add url and logo fields to Project model
project_additions = """    url = models.URLField(blank=True, null=True, help_text="Project website URL")
    logo = models.URLField(blank=True, null=True, help_text="Project logo URL")"""

# Find Project model and add fields before created_at
import_index = content.find('class Project(models.Model):')
if import_index != -1:
    # Find the line with created_at
    created_at_index = content.find('created_at = models.DateTimeField(auto_now_add=True)', import_index)
    if created_at_index != -1:
        # Insert before created_at
        content = content[:created_at_index] + project_additions + '\n    ' + content[created_at_index:]

# Add is_public and description fields to Workspace model
workspace_additions = """    is_public = models.BooleanField(default=False, help_text="Whether this workspace can be viewed publicly")
    description = models.TextField(blank=True, default='', help_text="Public description of what this workspace does")"""

# Find Workspace model and add fields before created_at
workspace_index = content.find('class Workspace(models.Model):')
if workspace_index != -1:
    # Find the line with created_at in Workspace
    created_at_index = content.find('created_at = models.DateTimeField(auto_now_add=True)', workspace_index)
    if created_at_index != -1:
        # Insert before created_at
        content = content[:created_at_index] + workspace_additions + '\n    ' + content[created_at_index:]

# Write back to models.py
with open(models_path, 'w') as f:
    f.write(content)

print("✅ Fields added to models.py")
print("🔧 Now run: python manage.py makemigrations && python manage.py migrate")