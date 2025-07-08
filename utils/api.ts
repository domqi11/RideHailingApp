// Backend API Configuration
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use your computer's IP address - mobile device is successfully connecting
const BASE_URL = 'http://192.168.0.4:3000/api';

interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = BASE_URL;
  }

  // Get auth token from storage
  async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Set auth token in storage
  async setAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('authToken', token);
    } catch (error) {
      console.error('Error setting auth token:', error);
    }
  }

  // Clear auth token
  async clearAuthToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem('authToken');
    } catch (error) {
      console.error('Error clearing auth token:', error);
    }
  }

  // Generic API request method with fast timeout
  async request(endpoint: string, options: RequestOptions = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const token = await this.getAuthToken();
    const timeout = options.timeout || 10000; // 10 second timeout
    
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (token) {
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - server may be down')), timeout)
      );

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url, config),
        timeoutPromise
      ]) as Response;

      console.log(`📬 Response status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        // Handle validation errors (arrays) and other error formats
        if (data.error && Array.isArray(data.error)) {
          errorMessage = data.error.map(err => err.message || err).join(', ');
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        console.error(`❌ API Error (${response.status}):`, errorMessage);
        console.error(`📄 Full error response:`, data);
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      console.error(`🚨 Network/API Error - ${endpoint}:`, error);
      
      // More specific error handling
      if (error.message.includes('timeout') || error.message === 'Network request failed') {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on http://192.168.0.4:3000');
      } else if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw error;
      }
    }
  }

  // Authentication methods
  async register(userData: any): Promise<any> {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (response.data.token) {
      await this.setAuthToken(response.data.token);
    }
    
    return response;
  }

  async login(email: string, password: string): Promise<any> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.data.token) {
      await this.setAuthToken(response.data.token);
    }
    
    return response;
  }

  async logout(): Promise<any> {
    await this.clearAuthToken();
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getProfile(): Promise<any> {
    return this.request('/auth/me');
  }

  // Ride methods
  async requestRide(rideData: any): Promise<any> {
    return this.request('/rides/request', {
      method: 'POST',
      body: JSON.stringify(rideData),
    });
  }

  async getRideHistory(params: Record<string, any> = {}): Promise<any> {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/rides/history?${queryString}`);
  }

  async getRideById(rideId: string): Promise<any> {
    return this.request(`/rides/${rideId}`);
  }

  async acceptRide(rideId: string): Promise<any> {
    return this.request(`/rides/${rideId}/accept`, {
      method: 'POST',
    });
  }

  async updateRideStatus(rideId: string, status: string, notes: string | null = null): Promise<any> {
    return this.request(`/rides/${rideId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  async cancelRide(rideId: string, reason: string | null = null): Promise<any> {
    return this.request(`/rides/${rideId}/cancel`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  // Driver methods
  async createDriverProfile(profileData: any): Promise<any> {
    return this.request('/drivers/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  async getDriverProfile(): Promise<any> {
    return this.request('/drivers/profile');
  }

  async updateDriverAvailability(isAvailable: boolean): Promise<any> {
    return this.request('/drivers/availability', {
      method: 'PUT',
      body: JSON.stringify({ is_available: isAvailable }),
    });
  }

  async getNearbyDrivers(latitude: number, longitude: number, radius: number = 5): Promise<any> {
    return this.request(`/drivers/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`);
  }

  // Location methods
  async updateLocation(latitude: number, longitude: number, heading: number | null = null): Promise<any> {
    return this.request('/locations/update', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, heading }),
    });
  }

  async getNearbyRides(latitude: number, longitude: number, radius: number = 10): Promise<any> {
    return this.request(`/rides/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`);
  }
}

export default new ApiService(); 