from django.apps import AppConfig


class TicketsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tickets'
    
    def ready(self):
        """Import signal handlers when the app is ready."""
        import tickets.models  # This ensures signals are registered