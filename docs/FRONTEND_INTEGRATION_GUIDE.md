# Frontend Integration Guide: Real-time Notifications (Flutter)

This guide explains how to integrate the notification system into your **Flutter** application.

## 1. Required Packages

Add these dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
  http: ^1.1.0
  flutter_local_notifications: ^16.3.0  # For local push notifications
  firebase_messaging: ^14.7.9  # For FCM
```

---

## 2. WebSocket Integration

The backend uses **Socket.IO** for real-time signaling.

### Connection Details

- **Namespace**: `/notifications`
- **Auth**: Requires a Bearer JWT Token in the handshake

### Implementation (Dart)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class NotificationSocketService {
  IO.Socket? socket;
  final String baseUrl = 'https://your-api-url.com';
  final String token;

  NotificationSocketService({required this.token});

  void connect() {
    socket = IO.io(
      '$baseUrl/notifications',
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': 'Bearer $token'})
        .build(),
    );

    socket?.onConnect((_) {
      print('Connected to /notifications namespace');
    });

    socket?.on('refresh', (data) {
      print('Refresh event received: $data');
      // Trigger notification refresh
      _handleRefresh(data);
    });

    socket?.onDisconnect((_) {
      print('Disconnected from /notifications');
    });
  }

  void _handleRefresh(dynamic payload) {
    // Notify listeners to refresh unread count and notification list
    // Use Provider, Riverpod, or GetX to update UI
  }

  void disconnect() {
    socket?.disconnect();
  }
}
```

---

## 3. Notification API (REST)

### API Service Class

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class NotificationApiService {
  final String baseUrl = 'https://your-api-url.com/api/v1';
  final String token;

  NotificationApiService({required this.token});

  Map<String, String> get _headers => {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  };

  // Get unread count
  Future<int> getUnreadCount() async {
    final response = await http.get(
      Uri.parse('$baseUrl/notifications/unread-count'),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data']['count'] as int;
    }
    throw Exception('Failed to fetch unread count');
  }

  // Get notifications with pagination
  Future<Map<String, dynamic>> getNotifications({
    int page = 1,
    int limit = 10,
    bool? read,
  }) async {
    String url = '$baseUrl/notifications?page=$page&limit=$limit';
    if (read != null) {
      url += '&read=$read';
    }

    final response = await http.get(
      Uri.parse(url),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return {
        'notifications': data['data']['notifications'],
        'pagination': data['data']['pagination'],
      };
    }
    throw Exception('Failed to fetch notifications');
  }

  // Mark notification as read
  Future<void> markAsRead(int notificationId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/notifications/$notificationId/read'),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to mark notification as read');
    }
  }

  // Mark all as read
  Future<void> markAllAsRead() async {
    final response = await http.patch(
      Uri.parse('$baseUrl/notifications/read-all'),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to mark all as read');
    }
  }
}
```

---

## 4. Complete Implementation Flow

### Step 1: Notification Bell Widget (Unread Count)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class NotificationBell extends StatefulWidget {
  @override
  _NotificationBellState createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int unreadCount = 0;
  late NotificationApiService apiService;
  late NotificationSocketService socketService;

  @override
  void initState() {
    super.initState();
    
    // Initialize services
    final token = 'YOUR_JWT_TOKEN'; // Get from secure storage
    apiService = NotificationApiService(token: token);
    socketService = NotificationSocketService(token: token);

    // Fetch initial count
    _fetchUnreadCount();

    // Connect to WebSocket
    socketService.connect();
    socketService.socket?.on('refresh', (_) {
      _fetchUnreadCount();
    });
  }

  Future<void> _fetchUnreadCount() async {
    try {
      final count = await apiService.getUnreadCount();
      setState(() {
        unreadCount = count;
      });
    } catch (e) {
      print('Error fetching unread count: $e');
    }
  }

  @override
  void dispose() {
    socketService.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        IconButton(
          icon: Icon(Icons.notifications),
          onPressed: () {
            Navigator.pushNamed(context, '/notifications');
          },
        ),
        if (unreadCount > 0)
          Positioned(
            right: 8,
            top: 8,
            child: Container(
              padding: EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
              child: Text(
                '$unreadCount',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
```

### Step 2: Notification Screen

```dart
import 'package:flutter/material.dart';

class NotificationScreen extends StatefulWidget {
  @override
  _NotificationScreenState createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  List<dynamic> notifications = [];
  Map<String, dynamic>? pagination;
  bool isLoading = false;
  
  late NotificationApiService apiService;
  late NotificationSocketService socketService;

  @override
  void initState() {
    super.initState();
    
    final token = 'YOUR_JWT_TOKEN'; // Get from secure storage
    apiService = NotificationApiService(token: token);
    socketService = NotificationSocketService(token: token);

    _fetchNotifications();

    // Listen for real-time updates
    socketService.connect();
    socketService.socket?.on('refresh', (_) {
      _fetchNotifications();
    });
  }

  Future<void> _fetchNotifications({int page = 1}) async {
    setState(() => isLoading = true);
    
    try {
      final result = await apiService.getNotifications(page: page);
      setState(() {
        notifications = result['notifications'];
        pagination = result['pagination'];
        isLoading = false;
      });
    } catch (e) {
      print('Error fetching notifications: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> _markAsRead(int notificationId) async {
    try {
      await apiService.markAsRead(notificationId);
      _fetchNotifications();
    } catch (e) {
      print('Error marking as read: $e');
    }
  }

  @override
  void dispose() {
    socketService.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await apiService.markAllAsRead();
              _fetchNotifications();
            },
            child: Text('Mark All Read', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: isLoading
        ? Center(child: CircularProgressIndicator())
        : ListView.builder(
            itemCount: notifications.length,
            itemBuilder: (context, index) {
              final notif = notifications[index];
              return NotificationTile(
                notification: notif,
                onTap: () => _markAsRead(notif['id']),
              );
            },
          ),
    );
  }
}

class NotificationTile extends StatelessWidget {
  final dynamic notification;
  final VoidCallback onTap;

  const NotificationTile({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isRead = notification['isRead'] ?? false;
    
    return ListTile(
      leading: Icon(
        Icons.notifications,
        color: isRead ? Colors.grey : Colors.blue,
      ),
      title: Text(
        notification['title'] ?? '',
        style: TextStyle(
          fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
        ),
      ),
      subtitle: Text(notification['message'] ?? ''),
      trailing: Text(
        _formatTime(notification['createdAt']),
        style: TextStyle(fontSize: 12, color: Colors.grey),
      ),
      onTap: onTap,
    );
  }

  String _formatTime(String? timestamp) {
    if (timestamp == null) return '';
    final date = DateTime.parse(timestamp);
    final now = DateTime.now();
    final diff = now.difference(date);
    
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
```

---

## 5. Firebase Cloud Messaging (FCM) Integration

### Save FCM Token to Backend

```dart
import 'package:firebase_messaging/firebase_messaging.dart';

class FCMService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final NotificationApiService apiService;

  FCMService({required this.apiService});

  Future<void> initialize() async {
    // Request permission
    await _fcm.requestPermission();

    // Get token
    String? token = await _fcm.getToken();
    if (token != null) {
      await _sendTokenToBackend(token);
    }

    // Listen for token refresh
    _fcm.onTokenRefresh.listen(_sendTokenToBackend);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
  }

  Future<void> _sendTokenToBackend(String token) async {
    // Send to your backend API
    // Example: PATCH /api/v1/users/me with { "fcmToken": token }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    print('Foreground notification: ${message.notification?.title}');
    // Show local notification or update UI
  }
}
```

---

## 6. Best Practices

1. **Token Management**: Store JWT tokens securely using `flutter_secure_storage`
2. **State Management**: Use Provider, Riverpod, or Bloc for managing notification state
3. **Connection Lifecycle**: Connect to WebSocket when app is active, disconnect when backgrounded
4. **Error Handling**: Always wrap API calls in try-catch blocks
5. **Debouncing**: Use `Timer` to debounce multiple refresh events

---

## 7. Development Tips

- **Namespace**: Always connect to `/notifications` namespace, not root `/`
- **Auto-Refresh**: Listen to `refresh` events to update UI automatically
- **Deep Linking**: Use the `data` field in notifications to navigate to specific screens
- **Testing**: Use Postman or the Swagger UI to test notification creation manually

### Notification Object Example

```json
{
  "id": 50,
  "type": "TRIP_APPROVED",
  "title": "Trip Approved",
  "message": "Your trip ID #42 has been fully approved.",
  "data": {
    "tripId": 42
  },
  "priority": "HIGH",
  "isRead": false
}
```

### Strategic Action Map

When a `refresh` event is received or a notification is clicked, follow this logic:

| Notification Type                  | Recommended UI Action                                  |
| :--------------------------------- | :----------------------------------------------------- |
| `TRIP_APPROVED` \| `TRIP_REJECTED` | Reload "My Rides" list / Navigate to Trip details      |
| `TRIP_APPROVAL_NEEDED`             | Reload "Approvals" tab                                 |
| `USER_APPROVED`                    | Allow access to main app / Show "Account Active" toast |
| `VEHICLE_ASSIGNED`                 | Reload "My Vehicles" / Play sound alert for Driver     |
| `TRIP_READING_START`               | (For Security) Reload "Meter Reading" list             |

---

## 4. Push Notifications (FCM)

To receive push notifications while the app is in the background:

1.  **Register Token**: Once the user logs in, request their FCM device token.
2.  **Sync with Backend**: Send the token to the backend (e.g., during login or a profile update) so it can be stored in the `User` entity's `fcmToken` column.
3.  **Background Handling**:
    - **Android/iOS**: The system handle's the display of the `title` and `body`.
    - **Payload**: The `data` sent via FCM matches the `data` field in the REST API (e.g., `{ "tripId": "42" }`). Use this for deep linking.

---

## 5. Development Tips

- **Namespace Scope**: Ensure you connect to the `/notifications` namespace, not the default root `/`.
- **Auto-Refresh**: Don't rely solely on user clicks. Use the `refresh` event to update counts automatically while the user is active.
- **Debouncing**: If the user receives multiple `refresh` events in a short window, debounce your API calls to avoid spamming the server.
