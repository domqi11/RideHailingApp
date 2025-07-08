import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import ApiService from '../utils/api';

const ApiTest = () => {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [firstName, setFirstName] = useState('Test');
  const [lastName, setLastName] = useState('User');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const testHealthCheck = async () => {
    try {
      // Direct fetch since health check doesn't use the API service
      const response = await fetch('http://localhost:3000/health');
      const data = await response.json();
      addLog(`✅ Health Check: ${data.message}`, 'success');
    } catch (error) {
      addLog(`❌ Health Check Failed: ${error.message}`, 'error');
    }
  };

  const testRegister = async () => {
    try {
      const userData = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: 'customer'
      };
      
      const response = await ApiService.register(userData);
      addLog(`✅ Registration: ${response.message}`, 'success');
      setIsLoggedIn(true);
      await loadProfile();
    } catch (error) {
      addLog(`❌ Registration Failed: ${error.message}`, 'error');
    }
  };

  const testLogin = async () => {
    try {
      const response = await ApiService.login(email, password);
      addLog(`✅ Login: ${response.message}`, 'success');
      setIsLoggedIn(true);
      await loadProfile();
    } catch (error) {
      addLog(`❌ Login Failed: ${error.message}`, 'error');
    }
  };

  const loadProfile = async () => {
    try {
      const response = await ApiService.getProfile();
      setProfile(response.data.user);
      addLog(`✅ Profile loaded: ${response.data.user.first_name}`, 'success');
    } catch (error) {
      addLog(`❌ Profile load failed: ${error.message}`, 'error');
    }
  };

  const testRideRequest = async () => {
    try {
      const rideData = {
        pickup_location: {
          latitude: -37.8136,
          longitude: 144.9631,
          address: "123 Collins Street, Melbourne"
        },
        destination: {
          latitude: -37.8200,
          longitude: 144.9700,
          address: "456 Flinders Street, Melbourne"
        }
      };
      
      const response = await ApiService.requestRide(rideData);
      addLog(`✅ Ride Requested: $${response.data.ride.fare}`, 'success');
    } catch (error) {
      addLog(`❌ Ride Request Failed: ${error.message}`, 'error');
    }
  };

  const testLogout = async () => {
    try {
      await ApiService.logout();
      setIsLoggedIn(false);
      setProfile(null);
      addLog(`✅ Logged out successfully`, 'success');
    } catch (error) {
      addLog(`❌ Logout failed: ${error.message}`, 'error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧪 Backend API Test</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Credentials</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Tests</Text>
        <TouchableOpacity style={styles.button} onPress={testHealthCheck}>
          <Text style={styles.buttonText}>Test Health Check</Text>
        </TouchableOpacity>
        
        {!isLoggedIn ? (
          <>
            <TouchableOpacity style={styles.button} onPress={testRegister}>
              <Text style={styles.buttonText}>Register New User</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={testLogin}>
              <Text style={styles.buttonText}>Login Existing User</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={loadProfile}>
              <Text style={styles.buttonText}>Load Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={testRideRequest}>
              <Text style={styles.buttonText}>Request Test Ride</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={testLogout}>
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {profile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current User</Text>
          <Text style={styles.profileText}>Name: {profile.first_name} {profile.last_name}</Text>
          <Text style={styles.profileText}>Email: {profile.email}</Text>
          <Text style={styles.profileText}>Role: {profile.role}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>API Logs</Text>
          <TouchableOpacity onPress={clearLogs}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        </View>
        {logs.map((log, index) => (
          <Text key={index} style={[styles.logText, styles[log.type]]}>
            [{log.timestamp}] {log.message}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  profileText: {
    fontSize: 16,
    marginBottom: 5,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearButton: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  logText: {
    fontSize: 12,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  success: {
    color: '#28a745',
  },
  error: {
    color: '#dc3545',
  },
  info: {
    color: '#333',
  },
});

export default ApiTest; 