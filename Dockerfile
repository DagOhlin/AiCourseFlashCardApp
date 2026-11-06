# Just Python. The app itself is mounted from the repository (see compose.yaml),
# so `git pull` updates it without rebuilding the image.
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
EXPOSE 8765 8766
CMD ["python3", "start.py", "--host", "0.0.0.0", "--no-browser", "--lan", "--share-port", "8766"]
