import pika
import json
import logging
from django.conf import settings
import threading
import time

logger = logging.getLogger(__name__)

class RabbitMQPublisher:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.connection = None
            self.channel = None
            self.initialized = True
            self._connect_with_retry()

    def _connect_with_retry(self, max_retries=5):
        """Connect to RabbitMQ with retry logic"""
        for attempt in range(max_retries):
            try:
                self._connect()
                return
            except Exception as e:
                logger.warning(f"Failed to connect to RabbitMQ (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error("Failed to connect to RabbitMQ after all retries")
                    raise

    def _connect(self):
        """Establish connection to RabbitMQ"""
        try:
            connection_params = pika.URLParameters(settings.RABBITMQ_URL)
            self.connection = pika.BlockingConnection(connection_params)
            self.channel = self.connection.channel()
            
            # Declare exchange
            self.channel.exchange_declare(
                exchange='user_events',
                exchange_type='topic',
                durable=True
            )
            
            # Declare queue for task service
            self.channel.queue_declare(queue='task_service_queue', durable=True)
            self.channel.queue_bind(
                exchange='user_events',
                queue='task_service_queue',
                routing_key='user.*'
            )
            
            logger.info("Connected to RabbitMQ successfully")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    def publish_event(self, routing_key, message):
        """Publish an event to RabbitMQ"""
        try:
            # Check connection health
            if not self.connection or self.connection.is_closed:
                self._connect_with_retry()
            
            self.channel.basic_publish(
                exchange='user_events',
                routing_key=routing_key,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                    content_type='application/json'
                )
            )
            logger.info(f"Published event: {routing_key} - {message}")
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")
            # Try to reconnect and republish
            try:
                self._connect_with_retry()
                self.channel.basic_publish(
                    exchange='user_events',
                    routing_key=routing_key,
                    body=json.dumps(message),
                    properties=pika.BasicProperties(
                        delivery_mode=2,
                        content_type='application/json'
                    )
                )
                logger.info(f"Republished event after reconnection: {routing_key}")
            except Exception as retry_error:
                logger.error(f"Failed to republish event after reconnection: {retry_error}")
                raise

    def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("RabbitMQ connection closed")

# Singleton instance
rabbitmq_publisher = RabbitMQPublisher()