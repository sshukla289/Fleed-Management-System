package com.fleet.modules.system.dto;

import java.util.List;

public record UpdateSystemConfigRequest(
    List<SystemConfigUpdateItemRequest> entries
) {
}
