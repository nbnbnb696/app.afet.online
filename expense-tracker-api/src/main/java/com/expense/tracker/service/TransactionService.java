package com.expense.tracker.service;

import com.expense.tracker.dto.*;
import com.expense.tracker.entity.Transaction;
import com.expense.tracker.entity.User;
import com.expense.tracker.repository.TransactionRepository;
import com.expense.tracker.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    public TransactionResponse createTransaction(TransactionRequest request, String username) {
        User user = userRepository.findByUsername(username).orElseThrow();
        Transaction transaction = new Transaction(
            request.getDescription(), 
            BigDecimal.valueOf(request.getAmount()), 
            Transaction.TransactionType.valueOf(request.getType()), 
            "General", // Default category
            request.getDate(), 
            user
        );
        transaction = transactionRepository.save(transaction);
        return mapToResponse(transaction);
    }

    public List<TransactionResponse> getAllTransactions(String username) {
        User user = userRepository.findByUsername(username).orElseThrow();
        return transactionRepository.findByUserOrderByDateDesc(user)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public TransactionResponse getTransaction(Long id, String username) {
        Transaction transaction = transactionRepository.findById(id).orElseThrow();
        return mapToResponse(transaction);
    }

    public TransactionResponse updateTransaction(Long id, TransactionRequest request, String username) {
        Transaction transaction = transactionRepository.findById(id).orElseThrow();
        
        transaction.setDescription(request.getDescription());
        transaction.setAmount(BigDecimal.valueOf(request.getAmount()));
        transaction.setType(Transaction.TransactionType.valueOf(request.getType()));
        transaction.setCategory("General");
        transaction.setDate(request.getDate());
        
        transaction = transactionRepository.save(transaction);
        return mapToResponse(transaction);
    }

    public void deleteTransaction(Long id, String username) {
        Transaction transaction = transactionRepository.findById(id).orElseThrow();
        transactionRepository.delete(transaction);
    }

    public List<TransactionResponse> getTransactionsByDateRange(LocalDate startDate, LocalDate endDate, String username) {
        User user = userRepository.findByUsername(username).orElseThrow();
        return transactionRepository.findByUserAndDateBetween(user, startDate, endDate)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    private TransactionResponse mapToResponse(Transaction transaction) {
        return new TransactionResponse(
            transaction.getId(), 
            transaction.getDescription(), 
            transaction.getAmount().doubleValue(), 
            transaction.getType().name(), 
            transaction.getCategory(), 
            transaction.getDate()
        );
    }
}