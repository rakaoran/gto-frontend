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

    // --- NEW: Store username in local storage ---
    localStorage.setItem('username', username.value)

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
  <div class="min-h-screen flex items-center justify-center bg-[#1F1F1F] p-4 relative overflow-hidden selection:bg-[#00E5FF] selection:text-black">
    
    <div class="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#FF0033] rounded-full mix-blend-screen filter blur-[128px] opacity-10 animate-pulse"></div>
    <div class="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-[#00E5FF] rounded-full mix-blend-screen filter blur-[128px] opacity-10 animate-pulse" style="animation-delay: 1.5s;"></div>

    <div class="w-full max-w-md bg-[#000000] border-2 border-[#1F1F1F] rounded-none shadow-[8px_8px_0px_0px_#00E5FF] relative z-10 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[12px_12px_0px_0px_#00E5FF]">
      
      <div class="p-8 border-b border-[#1F1F1F]">
        <h2 class="text-3xl font-black text-white uppercase italic tracking-tighter transform -skew-x-6">
          Welcome <span class="text-transparent bg-clip-text bg-linear-to-r from-[#00E5FF] to-[#FF0033]">Back</span>
        </h2>
        <p class="text-gray-500 font-mono text-xs mt-2 tracking-widest uppercase">
          // Resume Session
        </p>
      </div>
      
      <form @submit.prevent="handleLogin" class="p-8 space-y-6">
        
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
            placeholder="ENTER_ID" 
            required
          >
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
        
        <button 
          class="w-full bg-[#FF0033] hover:bg-[#ff1a47] text-black font-black uppercase text-lg py-4 border-2 border-transparent hover:border-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95" 
          type="submit"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Authenticating...' : 'Sign In' }}
        </button>
      </form>

      <div class="p-6 border-t border-[#1F1F1F] bg-[#050505] flex justify-between items-center">
        <router-link to="/" class="text-xs font-mono text-gray-500 hover:text-white transition-colors">
          &lt; ABORT
        </router-link>
        
        <p class="text-xs text-gray-500 font-mono">
          NO DATA? 
          <router-link to="/signup" class="text-[#00E5FF] hover:text-white hover:underline ml-1">
            CREATE_USER
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>