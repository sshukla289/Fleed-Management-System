package com.fleet.modules.pod.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "proof_of_delivery")
public class POD {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String tripId;

    private String signatureUrl;
    private String photoUrl;
    private boolean otpVerified;
    private LocalDateTime timestamp;
    private String otpCodeHash;
    private String otpHint;
    private LocalDateTime otpIssuedAt;
    private LocalDateTime otpExpiresAt;

    @Column(length = 128)
    private String signatureDigest;

    @Column(length = 128)
    private String photoDigest;

    private String otpPreviewCode;
    private String capturedByUserId;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTripId() {
        return tripId;
    }

    public void setTripId(String tripId) {
        this.tripId = tripId;
    }

    public String getSignatureUrl() {
        return signatureUrl;
    }

    public void setSignatureUrl(String signatureUrl) {
        this.signatureUrl = signatureUrl;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public boolean isOtpVerified() {
        return otpVerified;
    }

    public void setOtpVerified(boolean otpVerified) {
        this.otpVerified = otpVerified;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getOtpCodeHash() {
        return otpCodeHash;
    }

    public void setOtpCodeHash(String otpCodeHash) {
        this.otpCodeHash = otpCodeHash;
    }

    public String getOtpHint() {
        return otpHint;
    }

    public void setOtpHint(String otpHint) {
        this.otpHint = otpHint;
    }

    public LocalDateTime getOtpIssuedAt() {
        return otpIssuedAt;
    }

    public void setOtpIssuedAt(LocalDateTime otpIssuedAt) {
        this.otpIssuedAt = otpIssuedAt;
    }

    public LocalDateTime getOtpExpiresAt() {
        return otpExpiresAt;
    }

    public void setOtpExpiresAt(LocalDateTime otpExpiresAt) {
        this.otpExpiresAt = otpExpiresAt;
    }

    public String getSignatureDigest() {
        return signatureDigest;
    }

    public void setSignatureDigest(String signatureDigest) {
        this.signatureDigest = signatureDigest;
    }

    public String getPhotoDigest() {
        return photoDigest;
    }

    public void setPhotoDigest(String photoDigest) {
        this.photoDigest = photoDigest;
    }

    public String getOtpPreviewCode() {
        return otpPreviewCode;
    }

    public void setOtpPreviewCode(String otpPreviewCode) {
        this.otpPreviewCode = otpPreviewCode;
    }

    public String getCapturedByUserId() {
        return capturedByUserId;
    }

    public void setCapturedByUserId(String capturedByUserId) {
        this.capturedByUserId = capturedByUserId;
    }
}
