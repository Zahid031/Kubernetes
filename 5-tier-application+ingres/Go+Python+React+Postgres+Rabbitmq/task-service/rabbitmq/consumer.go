package rabbitmq


import (
	"encoding/json"
	"log"
	"time"

	"github.com/streadway/amqp"
	"gorm.io/gorm"
)

type UserEvent struct {
	UserID    uint   `json:"user_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	DeletedAt string `json:"deleted_at"`
}

type Task struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Completed   bool      `json:"completed"`
	UserID      uint      `json:"user_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Consumer struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	db      *gorm.DB
}

func NewConsumer(rabbitmqURL string, db *gorm.DB) (*Consumer, error) {
	conn, err := amqp.Dial(rabbitmqURL)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, err
	}

	return &Consumer{
		conn:    conn,
		channel: ch,
		db:      db,
	}, nil
}

func (c *Consumer) StartConsuming() error {
	// Declare the queue
	_, err := c.channel.QueueDeclare(
		"task_service_queue", // name
		true,                 // durable
		false,                // delete when unused
		false,                // exclusive
		false,                // no-wait
		nil,                  // arguments
	)
	if err != nil {
		return err
	}

	// Start consuming messages
	msgs, err := c.channel.Consume(
		"task_service_queue", // queue
		"",                   // consumer
		true,                 // auto-ack
		false,                // exclusive
		false,                // no-local
		false,                // no-wait
		nil,                  // args
	)
	if err != nil {
		return err
	}

	log.Println("RabbitMQ consumer started, waiting for messages...")

	go func() {
		for d := range msgs {
			c.handleUserEvent(d.RoutingKey, d.Body)
		}
	}()

	return nil
}

func (c *Consumer) handleUserEvent(routingKey string, body []byte) {
	log.Printf("Received message: %s - %s", routingKey, string(body))

	var event UserEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Failed to unmarshal event: %v", err)
		return
	}

	switch routingKey {
	case "user.created":
		c.handleUserCreated(event)
	case "user.updated":
		c.handleUserUpdated(event)
	case "user.deleted":
		c.handleUserDeleted(event)
	default:
		log.Printf("Unknown routing key: %s", routingKey)
	}
}

func (c *Consumer) handleUserCreated(event UserEvent) {
	log.Printf("User created: %d - %s", event.UserID, event.Name)
	// You can perform any task-related actions here when a user is created
	// For example, create a welcome task for the new user
	
	welcomeTask := Task{
		Title:       "Welcome to Todo App!",
		Description: "This is your first task. Start organizing your life!",
		UserID:      event.UserID,
		Completed:   false,
	}
	
	if err := c.db.Create(&welcomeTask).Error; err != nil {
		log.Printf("Failed to create welcome task for user %d: %v", event.UserID, err)
	} else {
		log.Printf("Created welcome task for user %d", event.UserID)
	}
}

func (c *Consumer) handleUserUpdated(event UserEvent) {
	log.Printf("User updated: %d - %s", event.UserID, event.Name)
	// Handle user updates if needed
	// For example, you could update task metadata or send notifications
}

func (c *Consumer) handleUserDeleted(event UserEvent) {
	log.Printf("User deleted: %d", event.UserID)
	
	// Delete all tasks for this user
	result := c.db.Where("user_id = ?", event.UserID).Delete(&Task{})
	if result.Error != nil {
		log.Printf("Failed to delete tasks for user %d: %v", event.UserID, result.Error)
	} else {
		log.Printf("Deleted %d tasks for user %d", result.RowsAffected, event.UserID)
	}
}

func (c *Consumer) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}