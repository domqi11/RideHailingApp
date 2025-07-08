import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import ApiService from '../utils/api';

type AuthScreen = 'login' | 'register' | 'forgot-password';

interface AuthFlowProps {
  onAuthSuccess: (user: any) => void;
}

const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthSuccess }) => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('login');
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmailSent(false);
  }, []);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Attempting login for:', email);
      const response = await ApiService.login(email, password);
      console.log('✅ Login successful');
      onAuthSuccess(response.data.user);
    } catch (error) {
      console.error('❌ Login failed:', error);
      
      // Better error message handling
      let errorMessage = 'Please check your credentials and try again.';
      
      if (error.message && typeof error.message === 'string') {
        try {
          // Try to parse if it's a JSON string
          const parsed = JSON.parse(error.message);
          if (Array.isArray(parsed)) {
            errorMessage = parsed.map(err => err.message).join(', ');
          } else if (parsed.message) {
            errorMessage = parsed.message;
          }
        } catch {
          // If not JSON, use the message directly
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [email, password, onAuthSuccess]);

  const handleRegister = useCallback(async () => {
    if (!email || !password || !firstName || !lastName) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const userData: any = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: 'customer'
      };
      
      // Only include phone if it has a value
      if (phone && phone.trim()) {
        userData.phone = phone.trim();
      }
      
      console.log('🔐 Attempting registration...');
      const response = await ApiService.register(userData);
      console.log('✅ Registration successful');
      onAuthSuccess(response.data.user);
    } catch (error) {
      console.error('❌ Registration failed:', error);
      
      // Better error message handling
      let errorMessage = 'Please try again.';
      
      if (error.message && typeof error.message === 'string') {
        try {
          // Try to parse if it's a JSON string
          const parsed = JSON.parse(error.message);
          if (Array.isArray(parsed)) {
            errorMessage = parsed.map(err => err.message).join(', ');
          } else if (parsed.message) {
            errorMessage = parsed.message;
          }
        } catch {
          // If not JSON, use the message directly
          errorMessage = error.message;
        }
      }
      
      if (error.message && error.message.includes('backend server is running')) {
        Alert.alert(
          'Backend Server Not Running', 
          'The backend server needs to be started. Please run the backend server on port 3000 and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Registration Failed', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, firstName, lastName, phone, onAuthSuccess]);

  const handleForgotPassword = useCallback(async () => {
    if (!email) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      // Simulate forgot password API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setEmailSent(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const LoginScreen = useMemo(() => (
    <View style={styles.screenContainer} key="login-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              key="login-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="next"
              textContentType="emailAddress"
              importantForAutofill="yes"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              key="login-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="done"
              textContentType="password"
              importantForAutofill="yes"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Feather 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.forgotPasswordButton}
          onPress={() => {
            resetForm();
            setCurrentScreen('forgot-password');
          }}
        >
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity 
            onPress={() => {
              resetForm();
              setCurrentScreen('register');
            }}
          >
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [email, password, showPassword, loading, handleLogin, resetForm]);

  const RegisterScreen = useMemo(() => (
    <View style={styles.screenContainer} key="register-screen">
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            resetForm();
            setCurrentScreen('login');
          }}
        >
          <AntDesign name="arrowleft" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join us and start your journey</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.nameRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>First name</Text>
            <View style={styles.inputContainer}>
              <Feather name="user" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                key="register-firstname"
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="next"
                textContentType="givenName"
                importantForAutofill="yes"
              />
            </View>
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>Last name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                key="register-lastname"
                style={[styles.input, { paddingLeft: 16 }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="next"
                textContentType="familyName"
                importantForAutofill="yes"
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              key="register-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="next"
              textContentType="emailAddress"
              importantForAutofill="yes"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone (optional)</Text>
          <View style={styles.inputContainer}>
            <Feather name="phone" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              key="register-phone"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="next"
              textContentType="telephoneNumber"
              importantForAutofill="yes"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              key="register-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="next"
              textContentType="newPassword"
              importantForAutofill="yes"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Feather 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Confirm password</Text>
          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              key="register-confirm-password"
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="done"
              textContentType="newPassword"
              importantForAutofill="yes"
            />
            <TouchableOpacity 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Feather 
                name={showConfirmPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity 
            onPress={() => {
              resetForm();
              setCurrentScreen('login');
            }}
          >
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [firstName, lastName, email, phone, password, confirmPassword, showPassword, showConfirmPassword, loading, handleRegister, resetForm]);

  const ForgotPasswordScreen = useMemo(() => (
    <View style={styles.screenContainer} key="forgot-password-screen">
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            resetForm();
            setCurrentScreen('login');
          }}
        >
          <AntDesign name="arrowleft" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          {emailSent 
            ? 'Check your email for reset instructions'
            : 'Enter your email to receive reset instructions'
          }
        </Text>
      </View>

      <View style={styles.form}>
        {emailSent ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <AntDesign name="checkcircle" size={64} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Email sent!</Text>
            <Text style={styles.successMessage}>
              We've sent password reset instructions to {email}
            </Text>
            
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => {
                resetForm();
                setCurrentScreen('login');
              }}
            >
              <Text style={styles.primaryButtonText}>Back to Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => setEmailSent(false)}
            >
              <Text style={styles.secondaryButtonText}>Resend email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Feather name="mail" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  key="forgot-email"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="done"
                  textContentType="emailAddress"
                  importantForAutofill="yes"
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Email</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  ), [email, emailSent, loading, handleForgotPassword, resetForm]);

  const renderCurrentScreen = useCallback(() => {
    switch (currentScreen) {
      case 'login':
        return LoginScreen;
      case 'register':
        return RegisterScreen;
      case 'forgot-password':
        return ForgotPasswordScreen;
      default:
        return LoginScreen;
    }
  }, [currentScreen, LoginScreen, RegisterScreen, ForgotPasswordScreen]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          bounces={false}
        >
          {renderCurrentScreen()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    gap: 24,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
});

export default AuthFlow; 