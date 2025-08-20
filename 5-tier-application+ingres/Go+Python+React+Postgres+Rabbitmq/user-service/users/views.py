from rest_framework import viewsets, status
from rest_framework.response import Response
from django.utils import timezone
from .models import User
from .serializers import UserSerializer
from .services.rabbitmq_service import rabbitmq_publisher
import logging

logger = logging.getLogger(__name__)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def list(self, request):
        """Get all users"""
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    
    def create(self, request):
        """Create a new user"""
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            try:
                # Publish user created event
                rabbitmq_publisher.publish_event(
                    'user.created',
                    {
                        'user_id': user.id,
                        'name': user.name,
                        'email': user.email,
                        'created_at': user.created_at.isoformat()
                    }
                )
                logger.info(f"Published user.created event for user {user.id}")
            except Exception as e:
                logger.error(f"Failed to publish user.created event: {e}")
                # Continue execution even if event publishing fails
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, pk=None):
        """Get a specific user"""
        try:
            user = User.objects.get(pk=pk)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    def update(self, request, pk=None):
        """Update a user"""
        try:
            user = User.objects.get(pk=pk)
            serializer = UserSerializer(user, data=request.data, partial=True)
            if serializer.is_valid():
                updated_user = serializer.save()
                
                try:
                    # Publish user updated event
                    rabbitmq_publisher.publish_event(
                        'user.updated',
                        {
                            'user_id': updated_user.id,
                            'name': updated_user.name,
                            'email': updated_user.email,
                            'updated_at': updated_user.updated_at.isoformat()
                        }
                    )
                    logger.info(f"Published user.updated event for user {updated_user.id}")
                except Exception as e:
                    logger.error(f"Failed to publish user.updated event: {e}")
                
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    def destroy(self, request, pk=None):
        """Delete a user"""
        try:
            user = User.objects.get(pk=pk)
            user_id = user.id
            user_name = user.name
            user.delete()
            
            try:
                # Publish user deleted event
                rabbitmq_publisher.publish_event(
                    'user.deleted',
                    {
                        'user_id': user_id,
                        'name': user_name,
                        'deleted_at': timezone.now().isoformat()
                    }
                )
                logger.info(f"Published user.deleted event for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to publish user.deleted event: {e}")
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)