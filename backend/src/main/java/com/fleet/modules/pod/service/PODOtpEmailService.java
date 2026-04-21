package com.fleet.modules.pod.service;

import com.fleet.modules.trip.entity.Trip;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class PODOtpEmailService {

    private static final Logger logger = LoggerFactory.getLogger(PODOtpEmailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final boolean enabled;

    public PODOtpEmailService(
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

    public boolean sendOtpSafely(Trip trip, String recipientEmail, String otp) {
        if (!isEnabled() || trip == null || recipientEmail == null || recipientEmail.isBlank() || otp == null || otp.isBlank()) {
            return false;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress.trim());
            helper.setTo(recipientEmail.trim());
            helper.setSubject("Delivery OTP for trip " + trip.getId());
            helper.setText(buildHtml(trip, otp), true);
            mailSender.send(message);
            return true;
        } catch (MessagingException | MailException exception) {
            logger.warn(
                "Failed to send POD OTP email for trip {} to {}: {}",
                trip.getId(),
                recipientEmail,
                exception.getMessage()
            );
            return false;
        }
    }

    private String buildHtml(Trip trip, String otp) {
        return """
            <html>
              <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
                <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;color:#64748b;">PROOF OF DELIVERY</p>
                  <h1 style="margin:0 0 16px;font-size:24px;">Delivery OTP for trip %s</h1>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                    A delivery attempt has reached %s. Share the one-time passcode below with the recipient only when the package handoff is complete.
                  </p>
                  <div style="margin:20px 0;padding:18px;border-radius:14px;background:#0f172a;color:#ffffff;text-align:center;">
                    <div style="font-size:12px;letter-spacing:0.2em;opacity:0.7;">ONE-TIME PASSCODE</div>
                    <div style="margin-top:8px;font-size:34px;font-weight:700;letter-spacing:0.32em;">%s</div>
                  </div>
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">
                    For security, do not forward this code to anyone except the on-site recipient. The code is valid for a limited time and is recorded with the final delivery evidence package.
                  </p>
                </div>
              </body>
            </html>
            """.formatted(trip.getId(), trip.getDestination(), otp);
    }
}
