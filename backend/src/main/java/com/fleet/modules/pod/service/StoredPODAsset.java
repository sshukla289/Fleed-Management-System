package com.fleet.modules.pod.service;

public record StoredPODAsset(
    String publicUrl,
    String sha256,
    long sizeBytes
) {}
