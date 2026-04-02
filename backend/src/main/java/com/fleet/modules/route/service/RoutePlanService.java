package com.fleet.modules.route.service;

import com.fleet.modules.route.dto.CreateRoutePlanRequest;
import com.fleet.modules.route.dto.RoutePlanDTO;
import com.fleet.modules.route.dto.UpdateRoutePlanRequest;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RoutePlanService {

    private final RoutePlanRepository routePlanRepository;

    public RoutePlanService(RoutePlanRepository routePlanRepository) {
        this.routePlanRepository = routePlanRepository;
    }

    public List<RoutePlanDTO> getRoutes() {
        return routePlanRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public RoutePlanDTO createRoute(CreateRoutePlanRequest request) {
        validateRouteRequest(
            request.name(),
            request.status(),
            request.distanceKm(),
            request.estimatedDuration(),
            request.stops()
        );

        RoutePlan routePlan = new RoutePlan(
            nextId(),
            request.name().trim(),
            request.status().trim(),
            request.distanceKm(),
            request.estimatedDuration().trim(),
            normalizeStops(request.stops())
        );

        return toDto(routePlanRepository.save(routePlan));
    }

    public List<RoutePlanDTO> optimizeRoutes() {
        return routePlanRepository.findAll().stream()
            .map(this::toDto)
            .sorted(
            Comparator
                .comparingInt((RoutePlanDTO route) -> statusPriority(route.status()))
                .thenComparingInt(RoutePlanDTO::distanceKm)
            )
            .toList();
    }

    public RoutePlanDTO updateRoute(String id, UpdateRoutePlanRequest request) {
        validateRouteRequest(
            request.name(),
            request.status(),
            request.distanceKm(),
            request.estimatedDuration(),
            request.stops()
        );

        RoutePlan routePlan = routePlanRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found."));

        routePlan.setName(request.name().trim());
        routePlan.setStatus(request.status().trim());
        routePlan.setDistanceKm(request.distanceKm());
        routePlan.setEstimatedDuration(request.estimatedDuration().trim());
        routePlan.setStops(normalizeStops(request.stops()));
        return toDto(routePlanRepository.save(routePlan));
    }

    public void deleteRoute(String id) {
        if (!routePlanRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found.");
        }

        routePlanRepository.deleteById(id);
    }

    private int statusPriority(String status) {
        return switch (status) {
            case "In Progress" -> 0;
            case "Scheduled" -> 1;
            default -> 2;
        };
    }

    private RoutePlanDTO toDto(RoutePlan routePlan) {
        return new RoutePlanDTO(
            routePlan.getId(),
            routePlan.getName(),
            routePlan.getStatus(),
            routePlan.getDistanceKm(),
            routePlan.getEstimatedDuration(),
            routePlan.getStops()
        );
    }

    private String nextId() {
        int nextNumber = routePlanRepository.findAll().stream()
            .map(RoutePlan::getId)
            .mapToInt(id -> parseNumericSuffix(id, "RT-"))
            .max()
            .orElse(500) + 1;
        return "RT-" + nextNumber;
    }

    private int parseNumericSuffix(String id, String prefix) {
        if (id == null || !id.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(id.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private void validateRouteRequest(
        String name,
        String status,
        int distanceKm,
        String estimatedDuration,
        List<String> stops
    ) {
        if (isBlank(name) || isBlank(status) || isBlank(estimatedDuration)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route fields are required.");
        }

        if (!List.of("Scheduled", "In Progress", "Completed").contains(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route status is invalid.");
        }

        if (distanceKm < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Distance must be zero or greater.");
        }

        List<String> normalizedStops = normalizeStops(stops);
        if (normalizedStops.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one stop is required.");
        }
    }

    private List<String> normalizeStops(List<String> stops) {
        if (stops == null) {
            return List.of();
        }

        return stops.stream()
            .filter(stop -> stop != null && !stop.trim().isEmpty())
            .map(String::trim)
            .toList();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
