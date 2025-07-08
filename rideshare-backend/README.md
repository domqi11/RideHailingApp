# 🚗 Rideshare Backend API

A comprehensive, scalable Node.js backend for ride-hailing applications with real-time features, built specifically to work with your React Native customer app and support a future driver app.

## 🌟 Features

- **Complete Authentication System** - JWT-based auth with role management
- **Real-time Communication** - WebSocket support for live updates
- **Geolocation Services** - Location tracking and driver matching
- **Ride Management** - Full ride lifecycle from request to completion
- **Multi-stop Support** - Handle complex routes with multiple stops
- **Driver Management** - Profile creation, availability, and ratings
- **Scalable Architecture** - Clean separation of concerns with proper MVC structure
- **Production Ready** - Security, error handling, and monitoring built-in

## 🏗️ Architecture

```
rideshare-backend/
├── src/
│   ├── controllers/       # Business logic controllers
│   ├── middleware/        # Authentication, validation, security
│   ├── routes/           # API route definitions
│   ├── services/         # Database and external service integrations
│   ├── utils/            # Helper functions and constants
│   └── app.js            # Main application entry point
├── config/               # Database and environment configuration
├── tests/                # Automated test suites
└── package.json          # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **Supabase** account (PostgreSQL database)
- **Google Maps API** key (optional, for enhanced features)

### 1. Installation

```bash
# Clone the repository
cd rideshare-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 2. Environment Configuration

Edit `.env` file with your credentials:

```env
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# External APIs
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3. Database Setup

Run this SQL in your Supabase SQL editor:

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
  last_login TIMESTAMP,
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
  stops JSONB,
  status TEXT CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  fare DECIMAL(10,2),
  distance_km DECIMAL(8,2),
  estimated_duration INTEGER,
  actual_duration INTEGER,
  payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,
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

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_available ON driver_profiles(is_available);
CREATE INDEX idx_rides_customer_id ON rides(customer_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created_at ON rides(created_at);
CREATE INDEX idx_user_locations_updated_at ON user_locations(updated_at);
CREATE INDEX idx_ride_requests_status ON ride_requests(status);
CREATE INDEX idx_ride_requests_expires_at ON ride_requests(expires_at);
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Run tests
npm test
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <your_jwt_token>
```

### Core Endpoints

#### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | `{ email, password, first_name, last_name, phone?, role? }` |
| POST | `/login` | User login | `{ email, password }` |
| POST | `/logout` | User logout | - |
| GET | `/me` | Get current user | - |
| POST | `/change-password` | Change password | `{ current_password, new_password }` |
| POST | `/refresh-token` | Refresh JWT token | - |
| GET | `/verify-token` | Verify token validity | - |

#### 👤 Users (`/api/users`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/profile` | Get user profile | Private |
| PUT | `/profile` | Update user profile | Private |
| DELETE | `/profile` | Deactivate account | Private |

#### 🚗 Drivers (`/api/drivers`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/profile` | Create driver profile | Driver |
| GET | `/profile` | Get driver profile | Driver |
| PUT | `/profile` | Update driver profile | Driver |
| PUT | `/availability` | Toggle availability | Driver |
| GET | `/nearby` | Find nearby drivers | Customer |

#### 🚖 Rides (`/api/rides`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/request` | Request a ride | Customer |
| POST | `/:id/accept` | Accept ride | Driver |
| PUT | `/:id/status` | Update ride status | Ride participant |
| GET | `/history` | Get ride history | Private |
| DELETE | `/:id/cancel` | Cancel ride | Ride participant |
| GET | `/nearby` | Get nearby rides | Driver |

#### 📍 Locations (`/api/locations`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/update` | Update user location | Private |
| GET | `/nearby-drivers` | Get nearby drivers | Customer |
| GET | `/:userId` | Get user location | Private |

### 🔌 WebSocket Events

Connect to: `ws://localhost:3000/socket.io`

#### Authentication
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

#### Events

**Connection Events:**
- `connected` - Connection established
- `room-joined` - Successfully joined room
- `room-left` - Successfully left room

**Location Events:**
- `location-update` - Location updated
- `driver-location` - Driver location broadcast

**Ride Events:**
- `ride-request` - New ride request (to drivers)
- `ride-accepted` - Ride accepted (to customer)
- `ride-update` - Ride status update
- `ride-cancelled` - Ride cancelled

**Example Usage:**
```javascript
// Update location
socket.emit('location-update', {
  latitude: -37.8136,
  longitude: 144.9631,
  heading: 90
});

// Request ride
socket.emit('ride-request', {
  pickupLocation: {
    latitude: -37.8136,
    longitude: 144.9631,
    address: "123 Collins Street, Melbourne"
  },
  destination: {
    latitude: -37.8200,
    longitude: 144.9700,
    address: "456 Flinders Street, Melbourne"
  }
});

// Listen for ride updates
socket.on('ride-update', (data) => {
  console.log('Ride status:', data.status);
});
```

## 🔗 Integration with React Native App

Your existing React Native app can integrate with this backend:

### 1. Authentication

```javascript
// Register/Login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  }),
});

const { data } = await response.json();
const { user, token } = data;

// Store token for future requests
await AsyncStorage.setItem('auth_token', token);
```

### 2. Ride Requests

```javascript
// Request a ride (matches your app's AddressManager format)
const requestRide = async (pickupLocation, destinationLocation) => {
  const token = await AsyncStorage.getItem('auth_token');
  
  const response = await fetch('http://localhost:3000/api/rides/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      pickup_location: {
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        address: pickupLocation.address
      },
      destination: {
        latitude: destinationLocation.latitude,
        longitude: destinationLocation.longitude,
        address: destinationLocation.address
      }
    }),
  });

  return await response.json();
};
```

### 3. Real-time Updates

```javascript
import io from 'socket.io-client';

const connectWebSocket = async () => {
  const token = await AsyncStorage.getItem('auth_token');
  
  const socket = io('http://localhost:3000', {
    auth: { token }
  });

  socket.on('ride-update', (data) => {
    // Update your app's ride state
    updateRideStatus(data.status);
  });

  socket.on('driver-location', (data) => {
    // Update driver location on map
    updateDriverMarker(data.latitude, data.longitude);
  });

  return socket;
};
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your_production_jwt_secret
SUPABASE_URL=your_production_supabase_url
SUPABASE_SERVICE_KEY=your_production_service_key
FRONTEND_URL=https://your-app-domain.com
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Monitoring

Check server health:
```bash
curl http://localhost:3000/health
```

## 📈 Performance & Scaling

### Database Optimization
- **Indexes** on frequently queried fields
- **Connection pooling** via Supabase
- **Query optimization** with proper joins and filtering

### Caching Strategy
- **Redis** for session storage (future enhancement)
- **In-memory caching** for frequently accessed data
- **CDN** for static assets

### Load Balancing
- **Horizontal scaling** with multiple server instances
- **Sticky sessions** for WebSocket connections
- **Database read replicas** for improved performance

## 🔧 Configuration

### Rate Limiting
```javascript
// Authentication: 5 attempts per 15 minutes
// General API: 100 requests per 15 minutes  
// Location updates: 60 per minute
```

### Security Features
- **Helmet.js** for security headers
- **CORS** configuration
- **JWT token** authentication
- **Password hashing** with bcrypt
- **Input validation** with Joi
- **SQL injection** prevention via parameterized queries

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check your Supabase credentials
# Ensure your IP is whitelisted in Supabase
# Verify network connectivity
```

**WebSocket Authentication Failed**
```bash
# Ensure JWT token is valid
# Check token expiration
# Verify token format in connection
```

**CORS Errors**
```bash
# Add your frontend URL to CORS configuration
# Check request headers and methods
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- **Documentation**: This README
- **Issues**: GitHub Issues
- **WebSocket Testing**: Use tools like Socket.IO client tester

---

**🎉 Your ride-hailing backend is now ready to handle real-world traffic!**

The backend integrates seamlessly with your existing React Native app and provides a solid foundation for building a driver app. The WebSocket implementation ensures real-time updates, while the scalable architecture supports future growth. 