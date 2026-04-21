package com.fleet.modules.driver.controller;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fleet.config.SecurityConfig;
import com.fleet.modules.analytics.dto.DriverPerformanceDashboardDTO;
import com.fleet.modules.analytics.service.OperationalAnalyticsService;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.security.AuthTokenFilter;
import com.fleet.modules.auth.security.RestAccessDeniedHandler;
import com.fleet.modules.auth.security.RestAuthenticationEntryPoint;
import com.fleet.modules.auth.service.AuthSessionService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DriverPerformanceController.class)
@Import({
    SecurityConfig.class,
    AuthTokenFilter.class,
    RestAuthenticationEntryPoint.class,
    RestAccessDeniedHandler.class
})
class DriverPerformanceControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OperationalAnalyticsService operationalAnalyticsService;

    @MockitoBean
    private AuthSessionService authSessionService;

    @Test
    void driverPerformanceAllowsDriverRole() throws Exception {
        when(authSessionService.resolveUser("driver-token")).thenReturn(Optional.of(user("DR-201", "DRIVER")));
        when(operationalAnalyticsService.getDriverPerformance(null, null)).thenReturn(new DriverPerformanceDashboardDTO(
            LocalDateTime.now(),
            null,
            null,
            List.of(),
            0.0,
            0,
            100.0,
            0.0,
            List.of()
        ));

        mockMvc.perform(
                get("/api/driver/performance")
                    .header("Authorization", "Bearer driver-token")
            )
            .andExpect(status().isOk());

        verify(operationalAnalyticsService).getDriverPerformance(null, null);
    }

    @Test
    void driverPerformanceRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/driver/performance"))
            .andExpect(status().isUnauthorized());

        verify(operationalAnalyticsService, never()).getDriverPerformance(null, null);
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
