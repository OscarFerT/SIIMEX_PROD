package com.example.proyecto.demo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.example.proyecto.demo.config.CatalogSeedRunner;
import com.example.proyecto.demo.config.InstitucionEducativaSeedRunner;
import com.example.proyecto.demo.config.ConvocatoriaDateTimeSchemaFixer;
import com.example.proyecto.demo.Service.MicrosoftGraphEmailService;
import com.example.proyecto.demo.Service.MicrosoftGraphTokenService;

@SpringBootTest
@MockitoBean(types = {CatalogSeedRunner.class, InstitucionEducativaSeedRunner.class,
        ConvocatoriaDateTimeSchemaFixer.class, MicrosoftGraphEmailService.class, MicrosoftGraphTokenService.class})
class DemoApplicationTests {

	@Test
	void contextLoads() {
	}

}
