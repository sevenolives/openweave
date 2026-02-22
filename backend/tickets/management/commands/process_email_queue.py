"""
Management command to manually process email queue.
"""
from django.core.management.base import BaseCommand
from celery import current_app
from tickets.tasks import (
    send_notification_email,
    send_ticket_assignment_notification,
    send_ticket_status_change_notification,
    send_comment_notification,
    send_project_agent_added_notification,
)


class Command(BaseCommand):
    help = 'Process pending email notification tasks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--inspect',
            action='store_true',
            help='Inspect the queue without processing tasks',
        )
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Flush all tasks from the queue',
        )

    def handle(self, *args, **options):
        celery_app = current_app
        
        if options['inspect']:
            self.inspect_queue(celery_app)
        elif options['flush']:
            self.flush_queue(celery_app)
        else:
            self.process_queue(celery_app)

    def inspect_queue(self, celery_app):
        """Inspect the queue and show pending tasks."""
        self.stdout.write("Inspecting email notification queue...")
        
        # Get active tasks
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active()
        scheduled_tasks = inspect.scheduled()
        
        if active_tasks:
            self.stdout.write("Active email tasks:")
            for worker, tasks in active_tasks.items():
                for task in tasks:
                    if 'email' in task['name'].lower():
                        self.stdout.write(f"  - {task['name']}: {task['id']}")
        
        if scheduled_tasks:
            self.stdout.write("Scheduled email tasks:")
            for worker, tasks in scheduled_tasks.items():
                for task in tasks:
                    if 'email' in task['request']['task'].lower():
                        self.stdout.write(f"  - {task['request']['task']}: {task['request']['id']}")
        
        if not active_tasks and not scheduled_tasks:
            self.stdout.write("No pending email tasks found.")

    def flush_queue(self, celery_app):
        """Flush all tasks from the queue."""
        self.stdout.write("Flushing email notification queue...")
        
        # Purge all tasks
        celery_app.control.purge()
        
        self.stdout.write(
            self.style.SUCCESS("Email queue has been flushed.")
        )

    def process_queue(self, celery_app):
        """Process pending email tasks."""
        self.stdout.write("Processing email notification queue...")
        
        # Start a worker to process tasks
        # Note: This is a simplified version. In production, you'd run a proper worker
        from celery.worker import worker
        
        app = celery_app
        worker_instance = worker.Worker(app=app)
        worker_instance.start()
        
        self.stdout.write(
            self.style.SUCCESS("Email queue processing started.")
        )