package com.expense.tracker.controller;

import com.expense.tracker.dto.*;
import com.expense.tracker.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
@CrossOrigin(origins = "*")
public class TransactionController {

    @Autowired
    private TransactionService transactionService;

    @PostMapping
    public ResponseEntity<TransactionResponse> createTransaction(@Valid @RequestBody TransactionRequest request, @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(transactionService.createTransaction(request, userDetails.getUsername()));
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> getAllTransactions(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(transactionService.getAllTransactions(userDetails.getUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> getTransaction(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(transactionService.getTransaction(id, userDetails.getUsername()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TransactionResponse> updateTransaction(@PathVariable Long id, @Valid @RequestBody TransactionRequest request, @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(transactionService.updateTransaction(id, request, userDetails.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTransaction(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        transactionService.deleteTransaction(id, userDetails.getUsername());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/filter")
    public ResponseEntity<List<TransactionResponse>> getTransactionsByDateRange(
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(transactionService.getTransactionsByDateRange(startDate, endDate, userDetails.getUsername()));
    }
}