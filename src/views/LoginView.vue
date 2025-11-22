<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { endpoints } from '../config'

const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  errorMsg.value = ''
  isLoading.value = true

  try {
    const response = await fetch(endpoints.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // CRITICAL: This allows the browser to receive the 'token' cookie from your backend
      credentials: 'include', 
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      // Handle specific backend errors (user-not-found, incorrect-password)
      throw new Error(data.message || 'Login failed')
    }

    // If successful, the cookie is now set automatically by the browser.
    // We can redirect to the game or home.
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
      <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Welcome Back 👋</h2>
      
      <form @submit.prevent="handleLogin">
        <div v-if="errorMsg" class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {{ errorMsg }}
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="username">Username</label>
          <input 
            v-model="username"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
            id="username" 
            type="text" 
            placeholder="Enter your username" 
            required
          >
        </div>
        
        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="password">Password</label>
          <input 
            v-model="password"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            required
          >
        </div>
        
        <button 
          class="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50" 
          type="submit"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-gray-600">
        Don't have an account? 
        <router-link to="/signup" class="text-blue-600 hover:underline">Sign up</router-link>
      </p>
      
      <div class="mt-2 text-center">
         <router-link to="/" class="text-sm text-gray-500 hover:text-gray-700">← Back to Home</router-link>
      </div>
    </div>
  </div>
</template>