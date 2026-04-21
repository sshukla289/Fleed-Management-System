package com.fleet.shared.api;

import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
public class ApiErrorResponseFactory {

    public static ApiErrorResponse create(HttpStatus status, String message, String path) {
        String resolvedMessage = message == null || message.isBlank() ? status.getReasonPhrase() : message;
        return new ApiErrorResponse(
            LocalDateTime.now(),
            status.value(),
            status.getReasonPhrase(),
            resolvedMessage,
            path
        );
    }
}
