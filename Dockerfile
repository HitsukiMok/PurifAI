# Use a stable Python image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# Set the working directory to the root where files are uploaded
WORKDIR /code

# Install system dependencies required for compiling certain Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# PRO-MOVE: Copy ONLY requirements.txt first to leverage Docker caching.
# This prevents PyTorch from re-downloading every time you change your Python code.
COPY requirements.txt .

# Upgrade pip FIRST to break the filelock backtracking loop
RUN pip install --no-cache-dir --upgrade pip

# Install dependencies from the copied requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the rest of your application code
COPY . .

# Expose the HF Spaces default port
EXPOSE 7860

# Start the application using Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]