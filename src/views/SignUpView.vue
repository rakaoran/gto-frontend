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

    // --- NEW: Store username in local storage ---
    localStorage.setItem('username', username.value)

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
  <div class="min-h-screen flex items-center justify-center bg-[#1F1F1F] p-4 relative overflow-hidden selection:bg-[#FF0033] selection:text-white">
    
    <div class="absolute top-0 left-1/4 w-96 h-96 bg-[#00E5FF] rounded-full mix-blend-screen filter blur-[128px] opacity-10 animate-pulse"></div>
    <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FF0033] rounded-full mix-blend-screen filter blur-[128px] opacity-10 animate-pulse" style="animation-delay: 1s;"></div>

    <div class="w-full max-w-md bg-[#000000] border-2 border-[#1F1F1F] rounded-none shadow-[8px_8px_0px_0px_#6B0000] relative z-10 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[12px_12px_0px_0px_#FF0033]">
      
      <div class="p-8 border-b border-[#1F1F1F]">
        <h2 class="text-3xl font-black text-white uppercase italic tracking-tighter transform -skew-x-6">
          New <span class="text-transparent bg-clip-text bg-linear-to-r from-[#FF0033] to-[#00E5FF]">Player</span>
        </h2>
        <p class="text-gray-500 font-mono text-xs mt-2 tracking-widest uppercase">
          // Initialize Profile
        </p>
      </div>
      
      <form @submit.prevent="handleSignUp" class="p-8 space-y-6">
        
        <div v-if="errorMsg" class="p-4 bg-[#6B0000]/20 border border-[#FF0033] text-[#FF0033] text-sm font-mono flex items-center gap-3">
          <span class="text-xl">⚠️</span>
          {{ errorMsg }}
        </div>

        <div class="group">
          <label class="block text-[#00E5FF] font-mono text-xs mb-2 uppercase tracking-wider group-focus-within:text-[#FF0033] transition-colors" for="username">
            Username
          </label>
          <input 
            v-model="username"
            class="w-full bg-[#1F1F1F] text-white px-4 py-3 border border-transparent focus:border-[#00E5FF] outline-none font-bold placeholder-gray-600 transition-all duration-200" 
            id="username" 
            type="text" 
            placeholder="PLAYER_ONE" 
            required
          >
          <p class="text-[10px] text-gray-500 mt-2 font-mono">
            [A-Z0-9_] ONLY • 3-20 CHARS
          </p>
        </div>
        
        <div class="group">
          <label class="block text-[#00E5FF] font-mono text-xs mb-2 uppercase tracking-wider group-focus-within:text-[#FF0033] transition-colors" for="password">
            Password
          </label>
          <input 
            v-model="password"
            class="w-full bg-[#1F1F1F] text-white px-4 py-3 border border-transparent focus:border-[#00E5FF] outline-none font-bold placeholder-gray-600 transition-all duration-200" 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            required
          >
        </div>

        <div class="group">
          <label class="block text-[#00E5FF] font-mono text-xs mb-2 uppercase tracking-wider group-focus-within:text-[#FF0033] transition-colors" for="confirmPassword">
            Confirm Password
          </label>
          <input 
            v-model="confirmPassword"
            class="w-full bg-[#1F1F1F] text-white px-4 py-3 border border-transparent focus:border-[#00E5FF] outline-none font-bold placeholder-gray-600 transition-all duration-200" 
            id="confirmPassword" 
            type="password" 
            placeholder="••••••••" 
            required
          >
        </div>
        
        <button 
          class="w-full bg-[#FF0033] hover:bg-[#ff1a47] text-black font-black uppercase text-lg py-4 border-2 border-transparent hover:border-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95" 
          type="submit"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Loading...' : 'Start Game' }}
        </button>
      </form>

      <div class="p-6 border-t border-[#1F1F1F] bg-[#050505] flex justify-between items-center">
        <router-link to="/" class="text-xs font-mono text-gray-500 hover:text-white transition-colors">
          &lt; ABORT
        </router-link>
        
        <p class="text-xs text-gray-500 font-mono">
          HAS ID? 
          <router-link to="/login" class="text-[#00E5FF] hover:text-white hover:underline ml-1">
            LOGIN_HERE
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>