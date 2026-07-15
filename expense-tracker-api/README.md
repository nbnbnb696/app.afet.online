# Expense Tracker API

A RESTful API for managing personal expenses and income built with Spring Boot.

## Features

- User authentication with JWT
- Create, read, update, and delete transactions
- Filter transactions by date range
- Separate tracking for income and expenses
- Secure endpoints with Spring Security

## Technologies

- Java 17
- Spring Boot 3.2.0
- Spring Security
- Spring Data JPA
- H2 Database
- JWT (JSON Web Tokens)
- Maven

## Prerequisites

- Java 17 or higher
- Maven 3.6+

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd expense-tracker-api
```

### 2. Run the application

```bash
mvn spring-boot:run
```

The API will start on `http://localhost:8080`

### 3. Access Swagger UI

Open your browser and navigate to:
```
http://localhost:8080/swagger-ui.html
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token

### Transactions (Requires Authentication)

- `POST /api/transactions` - Create a new transaction
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/{id}` - Get transaction by ID
- `PUT /api/transactions/{id}` - Update a transaction
- `DELETE /api/transactions/{id}` - Delete a transaction
- `GET /api/transactions/filter?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Filter transactions by date range

## Request Examples

### Register User

```json
POST /api/auth/register
{
  "username": "john",
  "email": "john@example.com",
  "password": "password123"
}
```

### Login

```json
POST /api/auth/login
{
  "username": "john",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Create Transaction

```json
POST /api/transactions
Authorization: Bearer <token>

{
  "description": "Salary",
  "amount": 50000,
  "type": "INCOME",
  "date": "2026-01-31"
}
```

## Database

The application uses H2 in-memory database. Data is stored in the `data` folder.

### H2 Console (Optional)

To enable H2 console, add to `application.properties`:
```properties
spring.h2.console.enabled=true
```

Access at: `http://localhost:8080/h2-console`

## Configuration

Edit `src/main/resources/application.properties` to configure:

- Server port
- Database settings
- JWT secret key
- JWT expiration time

## Build for Production

```bash
mvn clean package
java -jar target/expense-tracker-api-1.0.0.jar
```

## Security

- All endpoints except `/api/auth/**` require JWT authentication
- Add JWT token in Authorization header: `Bearer <token>`
- Passwords are encrypted using BCrypt

## License

MIT License
