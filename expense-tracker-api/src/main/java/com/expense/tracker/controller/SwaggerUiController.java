package com.expense.tracker.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SwaggerUiController {

    @GetMapping(value = "/swagger-ui.html", produces = MediaType.TEXT_HTML_VALUE)
    public String swaggerUi() {
        return "<html><head><meta http-equiv='refresh' content='0; url=/swagger-ui/index.html'/></head></html>";
    }
}
