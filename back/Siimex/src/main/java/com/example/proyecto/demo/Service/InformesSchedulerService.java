package com.example.proyecto.demo.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class InformesSchedulerService {

    private final PostulacionService postulacionService;

    /**
     * Ejecuta reglas automáticas de vencimiento de informes cada día a las 03:00 AM.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void ejecutarVencimientosInformes() {
        try {
            int total = postulacionService.ejecutarReglasAutomaticasInformes();
            if (total > 0) {
                log.info("Reglas automáticas de informes ejecutadas: {} solicitudes actualizadas", total);
            }
        } catch (Exception e) {
            log.warn("No se pudieron ejecutar reglas automáticas de informes: {}", e.getMessage());
        }
    }
}
