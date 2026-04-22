package com.fleet.modules.driver.controller;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fleet.config.SecurityConfig;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.security.AuthTokenFilter;
import com.fleet.modules.auth.security.RestAccessDeniedHandler;
import com.fleet.modules.auth.security.RestAuthenticationEntryPoint;
import com.fleet.modules.auth.service.AuthSessionService;
import com.fleet.modules.driver.dto.DriverProfileDTO;
import com.fleet.modules.driver.service.DriverProfileService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DriverProfileController.class)
@Import({
    SecurityConfig.class,
    AuthTokenFilter.class,
    RestAuthenticationEntryPoint.class,
    RestAccessDeniedHandler.class
})
class DriverProfileControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DriverProfileService driverProfileService;

    @MockitoBean
    private AuthSessionService authSessionService;

    @Test
    void getDriverProfileAllowsDriverRole() throws Exception {
        when(authSessionService.resolveUser("driver-token")).thenReturn(Optional.of(user("DR-201", "DRIVER")));
        when(driverProfileService.getProfile()).thenReturn(new DriverProfileDTO(
            "DR-201",
            "Aarav Sharma",
            "DRIVER",
            "driver@gmail.com",
            "Field Operations",
            "On Duty",
            "HMV",
            "+91 98765 43210",
            "VH-101",
            "Atlas Prime"
        ));

        mockMvc.perform(
                get("/api/driver/profile")
                    .header("Authorization", "Bearer driver-token")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("DR-201"))
            .andExpect(jsonPath("$.name").value("Aarav Sharma"))
            .andExpect(jsonPath("$.assignedVehicleId").value("VH-101"));

        verify(driverProfileService).getProfile();
    }

    @Test
    void getDriverProfileRejectsNonDriverRole() throws Exception {
        when(authSessionService.resolveUser("dispatcher-token")).thenReturn(Optional.of(user("USR-3", "DISPATCHER")));

        mockMvc.perform(
                get("/api/driver/profile")
                    .header("Authorization", "Bearer dispatcher-token")
            )
            .andExpect(status().isForbidden());

        verify(driverProfileService, never()).getProfile();
    }

    @Test
    void getDriverProfileRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/driver/profile"))
            .andExpect(status().isUnauthorized());
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
