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

// Simple navigation helper
const navigateTo = (path: string) => {
  router.push(path)
}

const handleLogout = async () => {
  try {
    // Send logout request to backend (clears httpOnly cookie)
    await fetch(endpoints.logout, {
      method: 'POST',
      credentials: 'include'
    })
  } catch (err) {
    console.error("Logout error:", err)
  } finally {
    // Clear frontend state regardless of backend success
    localStorage.removeItem('username')
    isLoggedIn.value = false
    username.value = ''
    router.push('/')
  }
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-indigo-50 via-white to-blue-100 text-slate-800 font-sans selection:bg-blue-200">
    
    <header class="container mx-auto px-4 py-20 flex flex-col items-center text-center">
      <div class="mb-6 animate-bounce text-6xl">🎨</div>
      <h1 class="text-6xl md:text-7xl font-extrabold mb-6 text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600 tracking-tight">
        GTO: Guess The Object
      </h1>
      
      <p class="text-xl md:text-2xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
        The ultimate multiplayer drawing game! Unleash your inner artist, 
        guess hilarious drawings, and battle your friends for the top spot.
      </p>

      <div class="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md mx-auto">
        
        <template v-if="isLoggedIn">
           <div class="w-full flex flex-col items-center gap-4">
              <p class="text-lg text-gray-700 font-medium">
                Welcome back, <span class="text-blue-600 font-bold">{{ username }}</span>!
              </p>

              <div class="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  @click="navigateTo('/game')" 
                  class="flex-1 px-8 py-4 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <span>Play Now</span>
                </button>

                <button 
                  @click="handleLogout" 
                  class="flex-1 px-6 py-4 bg-white text-red-500 font-semibold rounded-xl shadow-md border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all duration-200"
                >
                  Logout
                </button>
              </div>
           </div>
        </template>

        <template v-else>
          <div class="flex gap-3 w-full sm:w-auto">
            <button 
              @click="navigateTo('/login')" 
              class="flex-1 px-6 py-4 bg-white text-blue-600 font-semibold rounded-xl shadow-md border border-blue-100 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
            >
              Login
            </button>
            
            <button 
              @click="navigateTo('/signup')" 
              class="flex-1 px-6 py-4 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200"
            >
              Sign Up
            </button>
          </div>
        </template>

      </div>
    </header>

    <section class="container mx-auto px-6 py-12 max-w-5xl">
      <div class="grid md:grid-cols-3 gap-8">
        <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div class="text-4xl mb-4 bg-blue-100 w-16 h-16 flex items-center justify-center rounded-full">✏️</div>
          <h3 class="text-xl font-bold mb-2 text-slate-800">Draw & Express</h3>
          <p class="text-slate-600">
            Choose a word and draw it on the canvas. Use colors, brushes, and your imagination to convey the object!
          </p>
        </div>

        <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div class="text-4xl mb-4 bg-purple-100 w-16 h-16 flex items-center justify-center rounded-full">🤔</div>
          <h3 class="text-xl font-bold mb-2 text-slate-800">Guess Fast</h3>
          <p class="text-slate-600">
            Watch your opponents draw in real-time. Be the first to type the correct answer to earn maximum points.
          </p>
        </div>

        <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div class="text-4xl mb-4 bg-orange-100 w-16 h-16 flex items-center justify-center rounded-full">🏆</div>
          <h3 class="text-xl font-bold mb-2 text-slate-800">Climb the Ranks</h3>
          <p class="text-slate-600">
            Create private rooms for friends or join public matches to climb the global leaderboard.
          </p>
        </div>
      </div>
    </section>

    <footer class="text-center py-8 text-slate-400 text-sm">
      <p>&copy; {{ new Date().getFullYear() }} GTO App. Let the guessing begin!</p>
    </footer>
  </div>
</template>