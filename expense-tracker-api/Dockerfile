# Stage 1: Build the application using Maven
FROM maven:3.9.6-eclipse-temurin-17 AS build

# Set the working directory
WORKDIR /app

# Copy the Maven project files
COPY pom.xml .

# Copy the source code
COPY src ./src

# Build the application, skipping tests to speed up the process
RUN mvn clean package -DskipTests

# Stage 2: Create the final, smaller runtime image
FROM eclipse-temurin:17-jre-jammy

# Create a non-root user and group, and create the app directory
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 --shell /bin/bash --create-home appuser
# Set the working directory
WORKDIR /app

# Copy the built JAR file from the build stage
COPY --chown=appuser:appgroup --from=build /app/target/*.jar app.jar

# Switch to the non-root user
USER appuser

# Expose the port the application runs on
EXPOSE 8080

# Set the entrypoint to run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
