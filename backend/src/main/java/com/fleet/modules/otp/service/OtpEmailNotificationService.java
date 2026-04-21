package com.fleet.modules.otp.service;

import com.fleet.modules.trip.entity.Trip;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class OtpEmailNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(OtpEmailNotificationService.class);
    private static final DateTimeFormatter EXPIRY_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final boolean enabled;

    public OtpEmailNotificationService(
        JavaMailSender mailSender,
        @Value("${app.pod.email.from:${spring.mail.username:}}") String fromAddress,
        @Value("${app.pod.email.enabled:false}") boolean enabled
    ) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled && fromAddress != null && !fromAddress.isBlank();
    }

    public void sendOtp(Trip trip, String recipientEmail, String otp, LocalDateTime expiresAt) {
        if (!isEnabled()) {
            throw new IllegalStateException("OTP email delivery is disabled.");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress.trim());
            helper.setTo(recipientEmail.trim());
            helper.setSubject("Delivery OTP for trip " + trip.getId());
            helper.setText(buildHtml(trip, otp, expiresAt), true);
            mailSender.send(message);
        } catch (MessagingException | MailException exception) {
            logger.warn(
                "Failed to send OTP email for trip {} to {}: {}",
                trip.getId(),
                recipientEmail,
                exception.getMessage()
            );
            throw new IllegalStateException("OTP email delivery failed.", exception);
        }
    }

    private String buildHtml(Trip trip, String otp, LocalDateTime expiresAt) {
        return """
            <html>
              <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
                <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;color:#64748b;">PROOF OF DELIVERY</p>
                  <h1 style="margin:0 0 16px;font-size:24px;">Delivery OTP for trip %s</h1>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                    The delivery for %s has reached the recipient. Share the one-time passcode below only after confirming the handoff.
                  </p>
                  <div style="margin:20px 0;padding:18px;border-radius:14px;background:#0f172a;color:#ffffff;text-align:center;">
                    <div style="font-size:12px;letter-spacing:0.2em;opacity:0.7;">ONE-TIME PASSCODE</div>
                    <div style="margin-top:8px;font-size:34px;font-weight:700;letter-spacing:0.32em;">%s</div>
                  </div>
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">
                    This OTP expires at %s. If you did not expect this delivery, ignore this email and contact the fleet operations team.
                  </p>
                </div>
              </body>
            </html>
            """.formatted(
            trip.getId(),
            trip.getDestination(),
            otp,
            expiresAt == null ? "soon" : EXPIRY_FORMATTER.format(expiresAt)
        );
    }
}
