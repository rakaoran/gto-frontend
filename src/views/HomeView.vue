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
  <div class="min-h-screen bg-[#1F1F1F] text-gray-300 font-sans selection:bg-[#00E5FF] selection:text-black relative overflow-hidden flex flex-col">
    
    <div class="absolute top-0 left-0 w-[500px] h-[500px] bg-[#00E5FF] rounded-full mix-blend-screen filter blur-[150px] opacity-10 animate-pulse"></div>
    <div class="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FF0033] rounded-full mix-blend-screen filter blur-[150px] opacity-10 animate-pulse" style="animation-delay: 2s;"></div>

    <header class="container mx-auto px-4 py-20 flex flex-col items-center text-center relative z-10">
      
      <div class="mb-8 relative group">
        <div class="absolute inset-0 bg-[#FF0033] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FF0033" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" class="w-20 h-20 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,0,51,0.5)]">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          <path d="M12 22V12"></path>
        </svg>
      </div>

      <h1 class="text-6xl md:text-8xl font-black mb-6 uppercase italic tracking-tighter transform -skew-x-6">
        <span class="text-white drop-shadow-[4px_4px_0_#6B0000]">GTO</span>
        <span class="block text-2xl md:text-4xl mt-2 text-transparent bg-clip-text bg-linear-to-r from-[#00E5FF] to-[#FF0033] font-mono not-italic tracking-normal">
          // GUESS_THE_OBJECT
        </span>
      </h1>
      
      <p class="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed font-mono border-l-2 border-[#FF0033] pl-6 text-left">
        > INITIATING MULTIPLAYER DRAWING SEQUENCE...<br>
        > UNLEASH ARTISTIC ALGORITHMS.<br>
        > COMPETE FOR HIGH SCORE.
      </p>

      <div class="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md mx-auto">
        
        <template v-if="isLoggedIn">
           <div class="w-full flex flex-col items-center gap-6 p-6 border border-[#00E5FF]/30 bg-[#000000]/50 backdrop-blur-sm">
              <p class="text-lg text-[#00E5FF] font-mono tracking-widest uppercase">
                Welcome_Back :: <span class="text-white font-bold border-b border-[#FF0033]">{{ username }}</span>
              </p>

              <div class="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  @click="navigateTo('/game')" 
                  class="flex-1 px-8 py-4 bg-[#FF0033] hover:bg-[#ff1a47] text-black font-black text-lg uppercase tracking-wider transform hover:-translate-y-1 transition-all duration-200 shadow-[4px_4px_0px_0px_#6B0000]"
                >
                  Start_Game
                </button>

                <button 
                  @click="handleLogout" 
                  class="flex-1 px-6 py-4 bg-transparent border-2 border-[#1F1F1F] hover:border-white text-gray-400 hover:text-white font-mono uppercase tracking-wider transition-all duration-200"
                >
                  Logout
                </button>
              </div>
           </div>
        </template>

        <template v-else>
          <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button 
              @click="navigateTo('/login')" 
              class="flex-1 px-8 py-4 bg-transparent border-2 border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black font-bold uppercase tracking-widest text-sm transition-all duration-200"
            >
              Login
            </button>
            
            <button 
              @click="navigateTo('/signup')" 
              class="flex-1 px-8 py-4 bg-[#FF0033] hover:bg-[#ff1a47] text-black font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_#6B0000] hover:shadow-[6px_6px_0px_0px_#6B0000] hover:-translate-y-0.5 transition-all duration-200"
            >
              Sign_Up
            </button>
          </div>
        </template>

      </div>
    </header>

    <section class="container mx-auto px-6 py-12 max-w-6xl relative z-10 grow">
      <div class="grid md:grid-cols-3 gap-8">
        
        <div class="group bg-[#000000] p-8 border border-[#1F1F1F] hover:border-[#00E5FF] transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)]">
          <div class="mb-6 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-[#1F1F1F] group-hover:text-[#00E5FF] transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
             </svg>
          </div>
          <h3 class="text-xl font-bold mb-3 text-white uppercase tracking-wider">
            Draw & Express
          </h3>
          <p class="text-gray-500 font-mono text-sm leading-relaxed">
            [INPUT]: Choose word.<br>
            [PROCESS]: Use digital canvas tools.<br>
            [OUTPUT]: Visual masterpiece.
          </p>
        </div>

        <div class="group bg-[#000000] p-8 border border-[#1F1F1F] hover:border-[#FF0033] transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,0,51,0.2)]">
          <div class="mb-6 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-[#1F1F1F] group-hover:text-[#FF0033] transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
             </svg>
          </div>
          <h3 class="text-xl font-bold mb-3 text-white uppercase tracking-wider">
            Guess Fast
          </h3>
          <p class="text-gray-500 font-mono text-sm leading-relaxed">
            [DETECT]: Analyze incoming stream.<br>
            [ACTION]: Type answer rapidly.<br>
            [REWARD]: Maximum points gained.
          </p>
        </div>

        <div class="group bg-[#000000] p-8 border border-[#1F1F1F] hover:border-[#00E5FF] transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)]">
          <div class="mb-6 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-[#1F1F1F] group-hover:text-[#00E5FF] transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M12 20v-6M6 20V10M18 20V4"></path>
             </svg>
          </div>
          <h3 class="text-xl font-bold mb-3 text-white uppercase tracking-wider">
            Rank Up
          </h3>
          <p class="text-gray-500 font-mono text-sm leading-relaxed">
            [MODE]: Private rooms or Public.<br>
            [GOAL]: Dominate leaderboard.<br>
            [STATUS]: Global champion.
          </p>
        </div>

      </div>
    </section>

    <footer class="text-center py-8 border-t border-[#1F1F1F] bg-[#050505] text-[#1F1F1F]">
      <p class="font-mono text-xs text-gray-600">
        SYSTEM_ID: GTO-APP // &copy; {{ new Date().getFullYear() }} // END_OF_LINE
      </p>
    </footer>
  </div>
</template>