FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create database directory
RUN mkdir -p src/database

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV WEB_CONCURRENCY=1

# Run the application
CMD ["sh", "-c", "gunicorn -w ${WEB_CONCURRENCY} -b 0.0.0.0:5000 src.main:app"]
