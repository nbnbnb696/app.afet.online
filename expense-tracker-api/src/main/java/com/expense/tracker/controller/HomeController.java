package com.expense.tracker.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "Expense Tracker API is running! Available endpoints: /api/auth/register (POST), /api/auth/login (POST), /h2-console";
    }
}