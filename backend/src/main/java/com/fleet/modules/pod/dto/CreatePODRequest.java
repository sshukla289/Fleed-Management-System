package com.fleet.modules.pod.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.multipart.MultipartFile;

public class CreatePODRequest {

    @NotBlank
    private String signatureDataUrl;

    @NotNull
    private MultipartFile photo;

    public String getSignatureDataUrl() {
        return signatureDataUrl;
    }

    public void setSignatureDataUrl(String signatureDataUrl) {
        this.signatureDataUrl = signatureDataUrl;
    }

    public MultipartFile getPhoto() {
        return photo;
    }

    public void setPhoto(MultipartFile photo) {
        this.photo = photo;
    }
}
