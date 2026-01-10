<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { endpoints } from '../config'

const router = useRouter()
const isLoggedIn = ref(false)
const username = ref('')

onMounted(() => {
  const storedUser = localStorage.getItem('username')
  if (storedUser) {
    isLoggedIn.value = true
    username.value = storedUser
  }
})

const navigateTo = (path: string) => {
  router.push(path)
}

const handleLogout = async () => {
  try {
    await fetch(endpoints.logout, { method: 'POST', credentials: 'include' })
  } catch (err) {
    console.error("Logout error:", err)
  } finally {
    localStorage.removeItem('username')
    isLoggedIn.value = false
    username.value = ''
    router.push('/')
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0F1115] text-[#E6E6E6] font-sans selection:bg-[#4C8DFF] selection:text-white flex flex-col">
    
    <header class="container mx-auto px-4 py-20 flex flex-col items-center text-center max-w-4xl">
      
      <div class="mb-6 p-4 bg-[#171A21] rounded-2xl border border-[#242833] shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-12 h-12 text-[#4C8DFF]">
          <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
          <path d="M2 2l7.586 7.586"></path>
          <circle cx="11" cy="11" r="2"></circle>
        </svg>
      </div>

      <h1 class="text-4xl md:text-6xl font-bold mb-4 tracking-tight text-[#E6E6E6]">
        Guess The Object
      </h1>
      
      <p class="text-lg md:text-xl text-[#A0A4AB] mb-10 max-w-2xl leading-relaxed">
        A real-time multiplayer drawing and guessing game. Unleash your creativity, compete with friends, and climb the global leaderboard.
      </p>

      <div class="w-full max-w-md mx-auto">
        
        <template v-if="isLoggedIn">
           <div class="w-full flex flex-col items-center gap-6 p-6 bg-[#171A21] border border-[#242833] rounded-xl shadow-lg">
              <p class="text-[#A0A4AB]">
                Welcome back, <span class="text-[#E6E6E6] font-semibold">{{ username }}</span>
              </p>

              <div class="flex flex-col sm:flex-row gap-3 w-full">
                <button 
                  @click="navigateTo('/game')" 
                  class="flex-1 px-6 py-3 bg-[#4C8DFF] hover:bg-[#3b7cdb] text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  Start Game
                </button>

                <button 
                  @click="handleLogout" 
                  class="flex-1 px-6 py-3 bg-transparent border border-[#242833] hover:border-[#4C8DFF] text-[#A0A4AB] hover:text-[#4C8DFF] font-medium rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
           </div>
        </template>

        <template v-else>
          <div class="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <button 
              @click="navigateTo('/signup')" 
              class="px-8 py-3 bg-[#4C8DFF] hover:bg-[#3b7cdb] text-white font-semibold rounded-lg transition-colors shadow-md min-w-[140px]"
            >
              Sign Up
            </button>
            
            <button 
              @click="navigateTo('/login')" 
              class="px-8 py-3 bg-[#171A21] border border-[#242833] hover:border-[#4C8DFF] text-[#E6E6E6] hover:text-[#4C8DFF] font-medium rounded-lg transition-colors min-w-[140px]"
            >
              Login
            </button>
          </div>
        </template>

      </div>
    </header>

    <section class="container mx-auto px-6 py-12 max-w-6xl grow">
      <div class="grid md:grid-cols-3 gap-6">
        
        <div class="bg-[#171A21] p-8 border border-[#242833] rounded-xl hover:border-[#4C8DFF]/50 transition-colors duration-300">
          <div class="mb-5 flex items-center justify-center w-12 h-12 bg-[#242833] rounded-lg text-[#4C8DFF]">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
             </svg>
          </div>
          <h3 class="text-lg font-bold mb-2 text-[#E6E6E6]">
            Draw & Express
          </h3>
          <p class="text-[#A0A4AB] text-sm leading-relaxed">
            Choose a word and bring it to life using our smooth, responsive canvas tools. No artistic skills required—just imagination.
          </p>
        </div>

        <div class="bg-[#171A21] p-8 border border-[#242833] rounded-xl hover:border-[#4C8DFF]/50 transition-colors duration-300">
          <div class="mb-5 flex items-center justify-center w-12 h-12 bg-[#242833] rounded-lg text-[#4C8DFF]">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
             </svg>
          </div>
          <h3 class="text-lg font-bold mb-2 text-[#E6E6E6]">
            Guess Fast
          </h3>
          <p class="text-[#A0A4AB] text-sm leading-relaxed">
            Analyze the live stream of drawings and type your answer. Speed matters—the faster you guess, the more points you earn.
          </p>
        </div>

        <div class="bg-[#171A21] p-8 border border-[#242833] rounded-xl hover:border-[#4C8DFF]/50 transition-colors duration-300">
          <div class="mb-5 flex items-center justify-center w-12 h-12 bg-[#242833] rounded-lg text-[#4C8DFF]">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20v-6M6 20V10M18 20V4"></path>
             </svg>
          </div>
          <h3 class="text-lg font-bold mb-2 text-[#E6E6E6]">
            Rank Up
          </h3>
          <p class="text-[#A0A4AB] text-sm leading-relaxed">
            Create private rooms for friends or join public matches. Dominate the leaderboard and showcase your skills to the world.
          </p>
        </div>

      </div>
    </section>

    <footer class="text-center py-8 border-t border-[#242833] bg-[#0F1115]">
      <p class="text-sm text-[#A0A4AB]">
        © {{ new Date().getFullYear() }} Guess The Object. All rights reserved.
      </p>
    </footer>
  </div>
</template>