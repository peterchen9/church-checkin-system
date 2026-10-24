from django.urls import path
from . import sunday_views as views

app_name = 'sunday_checkin'
urlpatterns = [
    path('', views.sunday_page, name='home'),
    path('assets/<str:filename>', views.sunday_asset, name='asset'),
    path('members/', views.search_members, name='members'),
    path('checkin/', views.checkin, name='checkin'),
    path('barcodes/', views.barcode_page, name='barcodes'),
    path('barcodes/<int:church_id>/print/', views.print_labels, name='print'),
]
