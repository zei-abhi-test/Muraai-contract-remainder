# Web dynos must NOT run the scheduler (RUN_SCHEDULER unset/false), otherwise
# every gunicorn worker starts its own BackgroundScheduler and jobs fire N times.
web: gunicorn -w 4 -b 0.0.0.0:$PORT MURAAI.backend.src.main:app
# Scheduler worker: single process, set RUN_SCHEDULER=true on this process type only.
worker: gunicorn -w 1 -b 0.0.0.0:$PORT MURAAI.backend.src.main:app
