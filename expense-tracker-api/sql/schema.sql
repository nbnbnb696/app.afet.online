-- Expense Tracker API - Schema (SQL Server)
-- Matches entities: com.expense.tracker.entity.User, com.expense.tracker.entity.Transaction
-- Note: with spring.jpa.hibernate.ddl-auto=update, Hibernate will create/update these
-- tables automatically on app startup. This script is for manual/reference use only.

IF OBJECT_ID('dbo.transactions', 'U') IS NOT NULL DROP TABLE dbo.transactions;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;

CREATE TABLE users (
    id       BIGINT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email    VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE transactions (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    amount      DECIMAL(19,2) NOT NULL,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    category    VARCHAR(255) NOT NULL,
    date        DATE NOT NULL,
    user_id     BIGINT NOT NULL,
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id)
);
