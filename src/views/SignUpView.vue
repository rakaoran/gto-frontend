<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { endpoints } from '../config'

const router = useRouter()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

const handleSignUp = async () => {
  errorMsg.value = ''

  // Frontend Validation matching Backend Rules
  if (password.value !== confirmPassword.value) {
    errorMsg.value = "Passwords don't match!"
    return
  }
  if (password.value.length < 8) {
    errorMsg.value = "Password must be at least 8 characters long."
    return
  }
  // Regex from your Go backend: ^[a-z0-9_]{3,20}$
  const usernameRegex = /^[a-z0-9_]{3,20}$/i; 
  if (!usernameRegex.test(username.value)) {
    errorMsg.value = "Username must be 3-20 characters (letters, numbers, underscores only)."
    return
  }

  isLoading.value = true

  try {
    const response = await fetch(endpoints.signup, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      // Handle 'username-already-exists' etc.
      throw new Error(data.message || 'Signup failed')
    }

    // Success! Redirect to home (or game)
    router.push('/')

  } catch (err: any) {
    errorMsg.value = err.message
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
      <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Create Account 🚀</h2>
      
      <form @submit.prevent="handleSignUp">
        <div v-if="errorMsg" class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {{ errorMsg }}
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="username">Username</label>
          <input 
            v-model="username"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
            id="username" 
            type="text" 
            placeholder="user_123" 
            required
          >
          <p class="text-xs text-gray-500 mt-1">3-20 characters, letters, numbers & underscores.</p>
        </div>
        
        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="password">Password</label>
          <input 
            v-model="password"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            required
          >
        </div>

        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="confirmPassword">Confirm Password</label>
          <input 
            v-model="confirmPassword"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" 
            id="confirmPassword" 
            type="password" 
            placeholder="••••••••" 
            required
          >
        </div>
        
        <button 
          class="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-200 disabled:opacity-50" 
          type="submit"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Creating Account...' : 'Sign Up' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-gray-600">
        Already have an account? 
        <router-link to="/login" class="text-blue-600 hover:underline">Log in</router-link>
      </p>
      
       <div class="mt-2 text-center">
         <router-link to="/" class="text-sm text-gray-500 hover:text-gray-700">← Back to Home</router-link>
      </div>
    </div>
  </div>
</template>