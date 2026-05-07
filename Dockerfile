# Use a stable Python image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 7860

# Set the working directory
WORKDIR /code

# Install system dependencies needed for torch/transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the application code
# We copy the api folder into the code directory
COPY api/ .

# Expose the HF Spaces default port
EXPOSE 7860

# Start the application
# We use app:app because we copied the contents of api/ directly to /code
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
