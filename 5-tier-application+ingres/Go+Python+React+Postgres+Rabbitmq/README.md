# Todo Microservices with RabbitMQ

A distributed todo application built with microservices architecture using RabbitMQ for asynchronous communication between services.

## Architecture Overview

This project consists of two main microservices:

- **User Service** (Django REST Framework) - Manages user data and publishes events
- **Task Service** (Go/Gin) - Manages tasks and consumes user events via RabbitMQ

The services communicate asynchronously through RabbitMQ using the **Topic Exchange** pattern with event-driven architecture.

## Features

- **Event-Driven Architecture**: Services communicate via RabbitMQ events
- **Automatic Task Management**: Welcome tasks created for new users
- **Data Consistency**: Automatic cleanup of tasks when users are deleted
- **Resilient Messaging**: Connection retry logic and persistent messages
- **Singleton Pattern**: Efficient publisher connection management
- **Topic-based Routing**: Flexible message routing with `user.*` patterns

## Technology Stack

- **User Service**: Django REST Framework, Python, PostgreSQL
- **Task Service**: Go, Gin Framework, GORM, PostgreSQL
- **Message Broker**: RabbitMQ
- **Database**: PostgreSQL
- **Communication**: HTTP REST APIs + RabbitMQ Events

## RabbitMQ Implementation

### Publisher (User Service - Python)

The User Service includes a singleton RabbitMQ publisher with the following features:

- **Singleton Pattern**: Single connection instance across the application
- **Connection Resilience**: Automatic reconnection with exponential backoff
- **Persistent Messages**: Messages survive broker restarts
- **Topic Exchange**: Uses `user_events` exchange with topic routing

#### Key Events Published:
- `user.created` - When a new user is registered
- `user.updated` - When user information is modified
- `user.deleted` - When a user account is deleted

### Consumer (Task Service - Go)

The Task Service consumes user events and performs corresponding actions:

- **Automatic Welcome Tasks**: Creates a welcome task for new users
- **Data Cleanup**: Removes all tasks when a user is deleted
- **Event Logging**: Comprehensive logging of all processed events

## Setup and Installation

### Prerequisites

- Docker and Docker Compose
- Python 3.8+
- Go 1.19+
- PostgreSQL
- RabbitMQ

### Environment Variables

Create `.env` files for both services:

#### User Service (.env)
```env
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
DATABASE_URL=postgresql://username:password@localhost:5432/userdb
DEBUG=True
```

#### Task Service (.env)
```env
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
DATABASE_URL=postgres://username:password@localhost:5432/taskdb?sslmode=disable
```

### Quick Start with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd todo-microservices-rabbitmq
```

2. Start services with Docker Compose:
```bash
docker-compose up -d
```

3. Initialize databases:
```bash
# User service migrations
docker-compose exec user-service python manage.py migrate

# Task service will auto-migrate on startup
```

### Manual Setup

#### 1. Start RabbitMQ
```bash
docker run -d --hostname rabbitmq --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

#### 2. Setup User Service (Django)
```bash
cd user-service
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

#### 3. Setup Task Service (Go)
```bash
cd task-service
go mod tidy
go run main.go
```

## API Endpoints

### User Service (Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/` | Get all users |
| POST | `/api/users/` | Create new user |
| GET | `/api/users/{id}/` | Get user by ID |
| PUT | `/api/users/{id}/` | Update user |
| DELETE | `/api/users/{id}/` | Delete user |

### Task Service (Port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/` | Get all tasks |
| POST | `/api/tasks/` | Create new task |
| GET | `/api/tasks/{id}` | Get task by ID |
| PUT | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |
| GET | `/api/tasks/user/{user_id}` | Get tasks by user |

## RabbitMQ Configuration

### Exchange Configuration
- **Name**: `user_events`
- **Type**: `topic`
- **Durable**: `true`

### Queue Configuration
- **Name**: `task_service_queue`
- **Durable**: `true`
- **Routing Key**: `user.*`

### Message Format
```json
{
  "user_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-12-19T10:30:00Z",
  "updated_at": "2024-12-19T10:30:00Z",
  "deleted_at": null
}
```

## Event Flow Examples

### User Registration Flow
1. Client sends `POST /api/users/` to User Service
2. User Service creates user in database
3. User Service publishes `user.created` event to RabbitMQ
4. Task Service receives event and creates welcome task

### User Deletion Flow
1. Client sends `DELETE /api/users/{id}` to User Service
2. User Service soft deletes user from database
3. User Service publishes `user.deleted` event to RabbitMQ
4. Task Service receives event and deletes all user's tasks

## Monitoring and Debugging

### RabbitMQ Management Interface
Access the RabbitMQ management interface at: `http://localhost:15672`
- Username: `guest`
- Password: `guest`

### Logging
Both services provide comprehensive logging:

- **User Service**: Django logs for HTTP requests and RabbitMQ events
- **Task Service**: Go logs for HTTP requests and message consumption

### Health Checks
- **User Service**: `GET http://localhost:8000/admin/`
- **Task Service**: `GET http://localhost:8001/health`

## Testing the System

1. **Create a User**:
```bash
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

2. **Check Welcome Task Created**:
```bash
curl http://localhost:8001/api/tasks/user/1
```

3. **Delete User**:
```bash
curl -X DELETE http://localhost:8000/api/users/1/
```

4. **Verify Tasks Deleted**:
```bash
curl http://localhost:8001/api/tasks/user/1
```

## Error Handling

The system includes robust error handling:

- **Connection Failures**: Automatic reconnection with exponential backoff
- **Message Failures**: Retry logic for failed publications
- **Database Errors**: Comprehensive error logging and graceful degradation
- **Invalid Messages**: JSON parsing error handling

## Performance Considerations

- **Connection Pooling**: Singleton publisher pattern reduces connection overhead
- **Persistent Messages**: Ensures message delivery reliability
- **Durable Queues**: Messages survive broker restarts
- **Efficient Routing**: Topic exchange enables flexible message routing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check RabbitMQ logs for message flow debugging
- Review service logs for application-specific issues

---

**Note**: This is a demonstration project showing microservices communication patterns with RabbitMQ. For production use, consider additional security measures, monitoring tools, and deployment configurations.