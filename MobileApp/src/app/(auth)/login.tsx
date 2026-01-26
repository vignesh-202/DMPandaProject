import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useSession } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { Alert } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For sign-up
    const [loading, setLoading] = useState(false);
    const [isLoginView, setIsLoginView] = useState(true); // To toggle between login and sign-up
    const { signIn } = useSession();
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password || (!isLoginView && !name)) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        const endpoint = isLoginView ? '/api/login' : '/api/register';
        const payload = isLoginView ? { email, password } : { email, password, name };

        try {
            const response = await api.post(endpoint, payload);
            if (isLoginView) {
                if (response.data.token) {
                    await signIn(response.data.token);
                    // Navigation is handled by the _layout listener
                }
            } else {
                Alert.alert('Success', 'Registration successful! Please check your email to verify your account.');
            }
        } catch (error: any) {
            const msg = error.response?.data?.error || `${isLoginView ? 'Login' : 'Registration'} failed`;
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        // Implement Google Sign-In logic here
        Alert.alert('Info', 'Google Sign-In is not yet implemented.');
    };

    return (
        <StyledView className="flex-1 justify-center items-center bg-background px-6">
            <StyledView className="w-full max-w-sm bg-card p-8 rounded-2xl shadow-xl items-center">

                {/* App Logo */}
                <StyledImage
                    source={require('../../assets/images/logo.png')}
                    className="w-24 h-24 mb-6 rounded-full"
                    resizeMode="contain"
                />

                <StyledText className="text-3xl font-bold text-foreground mb-2 text-center">
                    {isLoginView ? 'Welcome Back' : 'Create Account'}
                </StyledText>
                <StyledText className="text-muted-foreground mb-8 text-center">
                    {isLoginView ? 'Sign in to your account' : 'Get started with DMPanda'}
                </StyledText>

                <StyledView className="w-full space-y-4">
                    {!isLoginView && (
                        <StyledView>
                            <StyledText className="text-foreground mb-2 text-sm font-medium">Name</StyledText>
                            <StyledTextInput
                                className="w-full bg-input text-foreground p-4 rounded-xl border border-border focus:border-primary"
                                placeholder="Enter your full name"
                                placeholderTextColor="#9ca3af"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                            />
                        </StyledView>
                    )}
                    <StyledView>
                        <StyledText className="text-foreground mb-2 text-sm font-medium">Email</StyledText>
                        <StyledTextInput
                            className="w-full bg-input text-foreground p-4 rounded-xl border border-border focus:border-primary"
                            placeholder="Enter your email"
                            placeholderTextColor="#9ca3af"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </StyledView>

                    <StyledView>
                        <StyledText className="text-foreground mb-2 text-sm font-medium">Password</StyledText>
                        <StyledTextInput
                            className="w-full bg-input text-foreground p-4 rounded-xl border border-border focus:border-primary"
                            placeholder="Enter your password"
                            placeholderTextColor="#9ca3af"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </StyledView>

                    <StyledTouchableOpacity
                        onPress={handleAuth}
                        disabled={loading}
                        className={`w-full bg-primary p-4 rounded-xl mt-6 ${loading ? 'opacity-70' : ''}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1f2937" />
                        ) : (
                            <StyledText className="text-primary-foreground text-center font-bold text-lg">
                                {isLoginView ? 'Sign In' : 'Sign Up'}
                            </StyledText>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>

                <StyledView className="flex-row items-center my-6">
                    <StyledView className="flex-1 h-px bg-border" />
                    <StyledText className="text-muted-foreground px-4">OR</StyledText>
                    <StyledView className="flex-1 h-px bg-border" />
                </StyledView>

                <StyledTouchableOpacity
                    onPress={handleGoogleSignIn}
                    className="w-full bg-secondary p-4 rounded-xl border border-border flex-row justify-center items-center"
                >
                    <StyledText className="text-secondary-foreground text-center font-bold text-lg">
                        Sign in with Google
                    </StyledText>
                </StyledTouchableOpacity>

                <StyledView className="flex-row justify-center mt-8">
                    <StyledText className="text-muted-foreground">
                        {isLoginView ? "Don't have an account? " : "Already have an account? "}
                    </StyledText>
                    <StyledTouchableOpacity onPress={() => setIsLoginView(!isLoginView)}>
                        <StyledText className="text-primary font-bold">
                            {isLoginView ? 'Sign Up' : 'Sign In'}
                        </StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledView>
        </StyledView>
    );
}
