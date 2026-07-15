package com.expense.tracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public class TransactionRequest {
    @NotBlank
    private String description;
    
    @NotNull
    @Positive
    private Double amount;
    
    @NotNull
    private String type;
    
    @NotNull
    private LocalDate date;
    
    public TransactionRequest() {}
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
}