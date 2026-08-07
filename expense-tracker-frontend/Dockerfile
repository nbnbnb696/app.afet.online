# Stage 1: Build the React app
FROM node:18-alpine AS build

ARG ENV_FILE=.env.production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . .
COPY ${ENV_FILE} .env.production
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Add custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built React app
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
