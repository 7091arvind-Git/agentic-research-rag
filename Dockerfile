# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY index.html vite.config.ts tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

RUN npx vite build

# ==========================================
# Stage 2: Production Python Microservice
# ==========================================
FROM python:3.12-slim AS runner
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/
COPY .env.example ./.env

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Environment configuration
ENV PORT=8000
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Run FastAPI production server
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
