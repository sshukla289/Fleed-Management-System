package com.fleet.modules.pod.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fleet.config.SecurityConfig;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.security.AuthTokenFilter;
import com.fleet.modules.auth.security.RestAccessDeniedHandler;
import com.fleet.modules.auth.security.RestAuthenticationEntryPoint;
import com.fleet.modules.auth.service.AuthSessionService;
import com.fleet.modules.pod.dto.PODDTO;
import com.fleet.modules.pod.service.PODService;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PODController.class)
@Import({
    SecurityConfig.class,
    AuthTokenFilter.class,
    RestAuthenticationEntryPoint.class,
    RestAccessDeniedHandler.class
})
class PODControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PODService podService;

    @MockitoBean
    private AuthSessionService authSessionService;

    @Test
    void createPodAllowsDriverRole() throws Exception {
        when(authSessionService.resolveUser("driver-token")).thenReturn(Optional.of(user("DR-201", "DRIVER")));
        when(podService.submit(org.mockito.ArgumentMatchers.eq("TRIP-1001"), any())).thenReturn(new PODDTO(
            "POD-1",
            "TRIP-1001",
            "/uploads/pod/signatures/signature.png",
            "/uploads/pod/photos/photo.jpg",
            true,
            LocalDateTime.now(),
            true,
            true,
            true,
            false
        ));

        mockMvc.perform(
                multipart("/api/trips/TRIP-1001/pod")
                    .file(new MockMultipartFile("photo", "photo.jpg", "image/jpeg", "demo".getBytes()))
                    .param("signatureDataUrl", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pR0K48AAAAASUVORK5CYII=")
                    .header("Authorization", "Bearer driver-token")
            )
            .andExpect(status().isCreated());

        verify(podService).submit(org.mockito.ArgumentMatchers.eq("TRIP-1001"), any());
    }

    @Test
    void createPodRejectsPlannerRole() throws Exception {
        when(authSessionService.resolveUser("planner-token")).thenReturn(Optional.of(user("PL-201", "PLANNER")));

        mockMvc.perform(
                multipart("/api/trips/TRIP-1001/pod")
                    .file(new MockMultipartFile("photo", "photo.jpg", "image/jpeg", "demo".getBytes()))
                    .param("signatureDataUrl", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pR0K48AAAAASUVORK5CYII=")
                    .header("Authorization", "Bearer planner-token")
            )
            .andExpect(status().isForbidden());

        verify(podService, never()).submit(org.mockito.ArgumentMatchers.eq("TRIP-1001"), any());
    }

    private AppUser user(String id, String role) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setRole(role);
        user.setEmail(id.toLowerCase() + "@fleet.test");
        user.setLoginEmail(id.toLowerCase() + "@fleet.test");
        user.setPassword("secret");
        return user;
    }
}
