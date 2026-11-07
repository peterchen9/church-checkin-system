from django.db import models


class Member(models.Model):
    church_id = models.BigIntegerField(primary_key=True)
    name = models.CharField(max_length=255, default='')
    mobile1 = models.CharField(max_length=50, blank=True, default='')
    phone_h = models.CharField(max_length=50, blank=True, default='')
    phone_o = models.CharField(max_length=50, blank=True, default='')
    section = models.CharField(max_length=100, blank=True, default='')
    family1 = models.CharField(max_length=255, blank=True, default='')
    first_daka = models.CharField(max_length=50, blank=True, default='')
    presence = models.IntegerField(default=0)

    class Meta:
        app_label = 'eureka'
        db_table = 'members'
        managed = False


class SundayCheckin(models.Model):
    church_id = models.BigIntegerField(db_index=True)
    date = models.DateField()
    service = models.CharField(max_length=20)
    checked_in_at = models.DateTimeField()
    recorded_by = models.CharField(max_length=150)

    class Meta:
        app_label = 'eureka'
        db_table = 'sunday_checkins'
        managed = False
        ordering = ['-checked_in_at']
        constraints = [models.UniqueConstraint(fields=['church_id', 'date', 'service'],
                                               name='sunday_member_day_service')]
