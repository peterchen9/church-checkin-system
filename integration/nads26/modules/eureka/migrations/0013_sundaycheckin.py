from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('eureka', '0012_correct_annual_leave_through_august')]
    operations = [migrations.CreateModel(
        name='SundayCheckin',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('church_id', models.BigIntegerField(db_index=True)),
            ('date', models.DateField()),
            ('service', models.CharField(max_length=20)),
            ('checked_in_at', models.DateTimeField()),
            ('recorded_by', models.CharField(max_length=150)),
        ],
        options={'db_table': 'sunday_checkins', 'ordering': ['-checked_in_at'],
                 'constraints': [models.UniqueConstraint(fields=('church_id', 'date', 'service'), name='sunday_member_day_service')]},
    )]
