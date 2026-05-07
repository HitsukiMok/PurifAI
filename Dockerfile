# Use a stable Python image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 7860

# Set the working directory to the root where files are uploaded
WORKDIR /code

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy everything from the Space root into the container /code
# This assumes requirements.txt, app.py, and all routers are at the root
COPY . .

# Install dependencies from the copied requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Expose the HF Spaces default port
EXPOSE 7860

# Start the application
# Since app.py is at the root of /code, we use app:app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
