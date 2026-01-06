# Real-time Notification System

## Overview

The notification system provides real-time updates to users via WebSockets and sends push notifications to mobile devices via Firebase Cloud Messaging (FCM). It is implemented as a core module (`src/modules/core/notifications`).

## Architecture

### Components

1. **NotificationsModule**: The NestJS module encapsulating all notification logic.
2. **NotificationsGateway**: A WebSocket gateway (Socket.IO) handling real-time connections.
   - **Namespace**: `/notifications`
   - **Events**: Emits `refresh` event to trigger frontend updates.
3. **NotificationsService**: The main service for creating, managing, and sending notifications.
   - Uses `EventEmitter2` for internal decoupling.
   - Uses `Redis` for Pub/Sub (scalable across multiple instances).
   - Uses `firebase-admin` for Push Notifications.
4. **NotificationsController**: REST API for fetching notification history and managing read status.

## Integration Guide

### Frontend Integration (WebSocket)

Connect to the WebSocket server to receive real-time updates.

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  auth: {
    token: 'Bearer <YOUR_JWT_TOKEN>',
  },
});

socket.on('connect', () => {
  console.log('Connected to notifications');
});

// Listen for refresh signals
socket.on('refresh', () => {
  // 1. Fetch updated unread count
  // 2. Refresh notification list if open
  // 3. Show toast/popup
  console.log('New notification received! Refreshing data...');
  fetchUnreadCount();
});
```

### REST API Endpoints

Base URL: `/api/v1/notifications`

| Method | Endpoint        | Description                                                                       |
| ------ | --------------- | --------------------------------------------------------------------------------- |
| GET    | `/`             | Get all notifications (paginated). Params: `page`, `limit`, `read` (bool), `type` |
| GET    | `/unread-count` | Get the count of unread active notifications.                                     |
| GET    | `/:id`          | Get details of a specific notification.                                           |
| PATCH  | `/:id/read`     | Mark a notification as read.                                                      |
| PATCH  | `/read-all`     | Mark ALL notifications as read.                                                   |
| DELETE | `/:id`          | Delete (soft delete) a notification.                                              |

### Sending Notifications (Backend)

Inject `NotificationsService` into your feature service to trigger notifications.

```typescript
import { NotificationsService } from 'src/modules/core/notifications/notifications.service';
import { NotificationType, NotificationPriority } from 'src/database/entities/notification.entity';

constructor(private readonly notificationsService: NotificationsService) {}

// ... inside a method
await this.notificationsService.create({
  type: NotificationType.TRIP_APPROVED,
  userId: '123', // Target user I
  title: 'Trip Approved',
  message: 'Your trip request #101 has been approved.',
  data: { tripId: 101 },
  priority: NotificationPriority.HIGH
});
```

### Push Notifications

- Push notifications are sent automatically when a notification is created via `NotificationsService.create()`.
- **Requirement**: The target User must have a valid `fcmToken` stored in the database.
- **Configuration**: Ensure `FCM_CREDENTIALS_PATH` or relevant Firebase environment variables are set.

## Supported Notification Types

### User Management

- `USER_REGISTERED`: New user registration (notifies approvers).
- `USER_APPROVED`: Account approved by admin.
- `USER_REJECTED`: Account rejected by admin.

### Trip Lifecycle

- `TRIP_CREATED`: New trip request (pending).
- `TRIP_APPROVAL_NEEDED`: Triggered for the next approver in the chain.
- `TRIP_APPROVED`: Trip fully approved.
- `TRIP_REJECTED`: Trip rejected by any approver.
- `TRIP_CANCELLED`: Trip cancelled by requester.
- `TRIP_READING_START`: Security recorded start odometer reading.
- `TRIP_STARTED`: Trip is now ongoing.
- `TRIP_FINISHED`: Trip reached destination (ready for end reading).
- `TRIP_READING_END`: Security recorded end odometer reading (trip completed).

### Vehicle Management

- `VEHICLE_ASSIGNED`: Driver assigned to a primary/secondary vehicle.
- `VEHICLE_UNASSIGNED`: Driver removed from a vehicle.
- `VEHICLE_UPDATED`: Changes to assigned vehicle details.

### System

- `MESSAGE_RECEIVED`: New message in a trip chat (if implemented).
- `SYSTEM_ALERT`: General system alerts or broadcast messages.
