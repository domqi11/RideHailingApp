# Coding Agent Instructions: Build Ride-Sharing Backend

## Project Overview
Build a complete Node.js backend API for a ride-sharing application (like Uber) that supports both customer and driver mobile apps. The backend should handle user authentication, ride requests, driver matching, real-time location tracking, and WebSocket communication.

## Technical Requirements
- **Runtime**: Node.js with Express.js framework
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: JWT tokens with bcryptjs password hashing
- **Real-time**: Socket.io for WebSocket connections
- **Architecture**: RESTful API with proper MVC structure
- **Testing**: Jest with Supertest for API testing

## Project Structure
Create this exact folder structure:

```
rideshare-backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── rideController.js
│   │   ├── locationController.js
│   │   ├── userController.js
│   │   └── driverController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── rides.js
│   │   ├── users.js
│   │   ├── drivers.js
│   │   └── locations.js
│   ├── services/
│   │   ├── databaseService.js
│   │   ├── locationService.js
│   │   └── notificationService.js
│   ├── utils/
│   │   ├── helpers.js
│   │   └── constants.js
│   └── app.js
├── config/
│   └── database.js
├── tests/
│   ├── auth.test.js
│   ├── rides.test.js
│   └── setup.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Database Schema
Implement these exact PostgreSQL tables in Supabase:

```sql
-- Users table (both drivers and customers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('driver', 'customer', 'both')) DEFAULT 'customer',
  profile_picture_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Driver specific info
CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  license_number TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_plate TEXT,
  is_available BOOLEAN DEFAULT false,
  rating DECIMAL(2,1) DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rides table
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  pickup_location JSONB NOT NULL,
  destination JSONB NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  fare DECIMAL(10,2),
  distance_km DECIMAL(8,2),
  estimated_duration INTEGER,
  actual_duration INTEGER,
  payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Real-time locations
CREATE TABLE user_locations (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(5, 2),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ride requests (for matching)
CREATE TABLE ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  pickup_location JSONB NOT NULL,
  destination JSONB NOT NULL,
  requested_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes'),
  status TEXT DEFAULT 'active'
);
```

## Required Dependencies
Install these exact packages:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "@supabase/supabase-js": "^2.38.0",
    "socket.io": "^4.7.2",
    "joi": "^17.9.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.2",
    "supertest": "^6.3.3"
  }
}
```

## Core Features to Implement

### 1. Authentication System
- User registration (customers and drivers)
- User login with JWT tokens
- Password hashing with bcryptjs
- Protected route middleware
- Role-based access control

**Required endpoints:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 2. User Management
- Get user profile
- Update user profile
- Driver profile creation and management
- Driver availability toggle

**Required endpoints:**
- `GET /api/users/profile`
- `PUT /api/users/profile`
- `POST /api/drivers/profile`
- `PUT /api/drivers/availability`

### 3. Ride Management
- Customer ride requests
- Driver ride acceptance
- Ride status updates
- Ride history
- Ride cancellation

**Required endpoints:**
- `POST /api/rides/request`
- `POST /api/rides/:id/accept`
- `PUT /api/rides/:id/status`
- `GET /api/rides/history`
- `DELETE /api/rides/:id/cancel`

### 4. Location Services
- Real-time location updates
- Find nearby drivers
- Location history
- Distance calculations

**Required endpoints:**
- `POST /api/locations/update`
- `GET /api/locations/nearby-drivers`
- `GET /api/locations/:userId`

### 5. Real-time Communication
- WebSocket connections for live updates
- Driver location broadcasting
- Ride status notifications
- Connection management

**WebSocket events:**
- `connection`
- `join-room`
- `location-update`
- `ride-update`
- `disconnect`

## Implementation Requirements

### Authentication Controller
```javascript
// Required functions in authController.js
- register(req, res)
- login(req, res)
- logout(req, res)
- getMe(req, res)
```

### Ride Controller
```javascript
// Required functions in rideController.js
- requestRide(req, res)
- acceptRide(req, res)
- updateRideStatus(req, res)
- getRideHistory(req, res)
- cancelRide(req, res)
- getNearbyRides(req, res)
```

### Location Controller
```javascript
// Required functions in locationController.js
- updateLocation(req, res)
- getNearbyDrivers(req, res)
- getLocationHistory(req, res)
```

### Middleware Requirements
- JWT authentication middleware
- Role-based authorization middleware
- Input validation middleware using Joi
- Error handling middleware
- CORS and security headers

### WebSocket Implementation
- Connection management
- Room-based messaging (driver rooms, customer rooms)
- Real-time location broadcasting
- Ride status updates
- Automatic reconnection handling

## Environment Variables
Create `.env` file with these variables:

```env
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# External APIs (for future use)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Testing Requirements
Write comprehensive tests for:
- Authentication endpoints
- Ride management endpoints
- Location services
- WebSocket connections
- Database operations

Use Jest and Supertest for API testing.

## Error Handling
Implement proper error handling:
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Server errors (500)
- Database connection errors

## Security Features
- Password hashing
- JWT token authentication
- Input validation and sanitization
- CORS configuration
- Rate limiting (optional)
- Helmet for security headers

## API Response Format
Standardize all API responses:

```javascript
// Success response
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {...}
}

// Error response
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Real-time Features
- Live driver location tracking
- Instant ride status updates
- Real-time driver-customer matching
- Push notification simulation via WebSockets

## Performance Considerations
- Database query optimization
- Connection pooling
- Efficient location queries using spatial data
- WebSocket connection management
- Memory usage optimization

## Documentation
Create comprehensive README.md with:
- Project setup instructions
- API endpoint documentation
- WebSocket event documentation
- Environment setup guide
- Testing instructions

## Deployment Preparation
- Production-ready configuration
- Environment variable management
- Database migration scripts
- Health check endpoints
- Logging configuration

## Success Criteria
The completed backend should:
1. ✅ Handle user registration and authentication
2. ✅ Support ride requests and driver matching
3. ✅ Track real-time locations
4. ✅ Provide WebSocket real-time communication
5. ✅ Have comprehensive API documentation
6. ✅ Include automated tests
7. ✅ Be deployment-ready
8. ✅ Follow REST API best practices
9. ✅ Implement proper error handling
10. ✅ Support both customer and driver workflows

## Important Notes
- Use async/await for all database operations
- Implement proper validation for all inputs
- Follow RESTful API conventions
- Use meaningful HTTP status codes
- Include proper logging throughout
- Handle edge cases (network failures, invalid data, etc.)
- Ensure scalable architecture patterns
- Document all functions and complex logic

Start with the basic project setup, then implement features in this order:
1. Project structure and dependencies
2. Database connection
3. Authentication system
4. Basic CRUD operations
5. Real-time features
6. Testing
7. Documentation
