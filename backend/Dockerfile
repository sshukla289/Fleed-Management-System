# syntax=docker/dockerfile:1.7

FROM maven:3.9.9-eclipse-temurin-17 AS base
RUN groupadd --gid 10001 spring \
    && useradd --uid 10001 --gid 10001 --create-home --home-dir /home/spring --shell /bin/bash spring \
    && mkdir -p /workspace /workspace/target /home/spring/.m2 \
    && chown -R spring:spring /workspace /home/spring
WORKDIR /workspace
COPY --chown=spring:spring pom.xml ./
USER spring
RUN --mount=type=cache,target=/home/spring/.m2,uid=10001,gid=10001 mvn -q -DskipTests dependency:go-offline

FROM base AS dev
EXPOSE 8080
CMD ["mvn", "-q", "-DskipTests", "spring-boot:run"]

FROM base AS build
COPY --chown=spring:spring src ./src
RUN --mount=type=cache,target=/home/spring/.m2,uid=10001,gid=10001 mvn -q -DskipTests package

FROM eclipse-temurin:17-jre AS runtime
RUN useradd --system --create-home --home-dir /home/spring --shell /usr/sbin/nologin spring
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
USER spring
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
