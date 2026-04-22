package com.fleet.modules.system.dto;

public record SystemConfigUpdateItemRequest(
    String key,
    String value
) {
}
