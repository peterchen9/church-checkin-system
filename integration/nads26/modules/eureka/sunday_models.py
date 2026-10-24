from django.db import models


class SundayCheckin(models.Model):
    church_id = models.BigIntegerField(db_index=True)
    date = models.DateField()
    service = models.CharField(max_length=20)
    checked_in_at = models.DateTimeField()
    recorded_by = models.CharField(max_length=150)

    class Meta:
        app_label = 'eureka'
        db_table = 'sunday_checkins'
        ordering = ['-checked_in_at']
        constraints = [models.UniqueConstraint(
            fields=['church_id', 'date', 'service'], name='sunday_member_day_service')]
