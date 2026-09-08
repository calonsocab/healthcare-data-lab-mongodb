FROM node:20-slim

RUN apt-get update && apt-get upgrade -y libgnutls30 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build-time args (NEXT_PUBLIC_* get baked into the bundle)
ARG NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_MONGODBEHR_URL
ARG NEXT_PUBLIC_KEHRNEL_DOCS_URL
ARG BACKEND_URL

# Set build-time env vars
ENV NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT=${NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_MONGODBEHR_URL=${NEXT_PUBLIC_MONGODBEHR_URL}
ENV NEXT_PUBLIC_KEHRNEL_DOCS_URL=${NEXT_PUBLIC_KEHRNEL_DOCS_URL}
ENV BACKEND_URL=${BACKEND_URL}

COPY ./package*.json ./
RUN npm install
COPY . .

# Set the port environment variable for Next.js
# This is used by the Docker Compose file
ENV PORT=8080

# Build the Next.js app
RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start"]