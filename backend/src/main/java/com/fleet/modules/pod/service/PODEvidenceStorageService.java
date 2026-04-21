package com.fleet.modules.pod.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PODEvidenceStorageService {

    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$");
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of("image/png", "image/jpeg", "image/webp");
    private static final long MAX_SIGNATURE_BYTES = 2L * 1024 * 1024;
    private static final long MAX_PHOTO_BYTES = 5L * 1024 * 1024;

    private final Path signaturesDirectory;
    private final Path photosDirectory;

    public PODEvidenceStorageService(@Value("${app.storage.public-root-dir:uploads}") String publicRootDir) {
        Path publicRoot = Path.of(publicRootDir).toAbsolutePath().normalize();
        this.signaturesDirectory = publicRoot.resolve("pod").resolve("signatures");
        this.photosDirectory = publicRoot.resolve("pod").resolve("photos");
    }

    public StoredPODAsset storeSignature(String signatureDataUrl) {
        if (signatureDataUrl == null || signatureDataUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A delivery signature is required.");
        }

        Matcher matcher = DATA_URL_PATTERN.matcher(signatureDataUrl.trim());
        if (!matcher.matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature data is not a valid image payload.");
        }

        String contentType = matcher.group(1).toLowerCase(Locale.ROOT);
        if (!SUPPORTED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature must be a PNG, JPEG, or WebP image.");
        }

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature data could not be decoded.");
        }

        if (bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A non-empty signature is required.");
        }

        if (bytes.length > MAX_SIGNATURE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Signature image exceeds the 2 MB limit.");
        }

        String extension = extensionFor(contentType);
        return write(signaturesDirectory, "pod-signature-", extension, bytes);
    }

    public StoredPODAsset storePhoto(MultipartFile photo) {
        if (photo == null || photo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A delivery photo is required.");
        }

        String contentType = photo.getContentType();
        if (contentType == null || !SUPPORTED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Delivery photo must be a PNG, JPEG, or WebP image.");
        }

        if (photo.getSize() > MAX_PHOTO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Delivery photo exceeds the 5 MB limit.");
        }

        try {
            return write(photosDirectory, "pod-photo-", extensionFor(contentType), photo.getBytes());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store the delivery photo.");
        }
    }

    private StoredPODAsset write(Path directory, String prefix, String extension, byte[] bytes) {
        String filename = prefix + UUID.randomUUID() + "." + extension;
        Path target = directory.resolve(filename).normalize();

        try {
            Files.createDirectories(directory);
            Files.write(target, bytes);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store delivery evidence.");
        }

        return new StoredPODAsset(
            "/uploads/pod/" + (directory.endsWith("signatures") ? "signatures/" : "photos/") + filename,
            sha256(bytes),
            bytes.length
        );
    }

    private String extensionFor(String contentType) {
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(messageDigest.digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is unavailable.", exception);
        }
    }
}
