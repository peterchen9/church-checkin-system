from .public_names import public_names
from django.urls import include, path
from modules.eureka import sunday_urls, sunday_views
from .auth import login

routes = list(sunday_urls.urlpatterns) + [path('login/', login, name='login')]
eureka_routes = [path('sunday/', include((routes, 'sunday_checkin')))]
urlpatterns = [
    path('sunday/mobile/<str:token>/', public_names, name='public-names'),
    path('sunday.html', sunday_views.sunday_page),
    path('barcode-print.html', sunday_views.barcode_page),
    path('', include((eureka_routes, 'eureka'))),
]
