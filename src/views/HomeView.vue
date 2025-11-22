<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800">
    <h1 class="text-5xl font-bold mb-8 text-blue-600">🎨 GTO App</h1>
    <p class="text-xl mb-8 text-gray-600">Welcome! Please log in or sign up to start drawing.</p>
    
    <div class="flex gap-4">
      <button 
        @click="router.push('/login')" 
        class="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 transition duration-200"
      >
        Login
      </button>
      
      <button 
        @click="router.push('/signup')" 
        class="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg font-semibold shadow-sm hover:bg-blue-50 transition duration-200"
      >
        Sign Up
      </button>
    </div>
  </div>
</template>