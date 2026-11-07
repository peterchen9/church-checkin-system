FROM nads26-web
RUN python -m pip install --no-cache-dir 'gunicorn>=23,<24'
WORKDIR /srv/app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY app/ /srv/app/
USER 1000:1000
CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "45", "--access-logfile", "-", "--error-logfile", "-", "standalone.wsgi:application"]
