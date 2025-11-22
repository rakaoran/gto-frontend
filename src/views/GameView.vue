<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '../config'
import { Dende, type IDendePart, DendePartType } from '../dende'
import { DrawingData } from '../proto/drawing'
import { Event, Message, WordChoice, TurnSummary } from '../proto/serialization'

const router = useRouter()

// --- Constants ---
const SERIAL_EVENT = 0
const SERIAL_MESSAGE = 1
const SERIAL_DRAWING = 2 
const SERIAL_WORD_CHOICE = 3
const SERIAL_TURN_SUMMARY = 4
const SERIAL_INITIAL_PLAYERS_AND_SCORES = 5 // <--- New Constant

// --- Event Types ---
const EVENT_PLAYER_JOINED = 0
const EVENT_PLAYER_RECONNECTED = 1
const EVENT_PLAYER_LEFT = 2
const EVENT_PlAYER_CHOOSING_WORD = 3
const EVENT_GAME_STARTED = 4
const EVENT_PLEASE_CHOOSE_WORD = 5
const EVENT_PLAYER_STARTED_DRAWING = 6
const EVENT_PLAYER_HAS_GUESSED_THE_WORD = 7
const EVENT_TURN_SUMMARY = 8
const EVENT_NEXT_ROUND = 9
const EVENT_LEADERBOARD = 10 

// --- State ---
const dendeContainer = ref<HTMLElement | null>(null)
const socket = ref<WebSocket | null>(null)
const isConnected = ref(false)
const statusMessage = ref('Connecting...')
const chatBox = ref<HTMLElement | null>(null)
const chatInput = ref('')

// Game Data
interface Player {
  username: string
  score: number
  guessed: boolean
}

interface TurnResult {
  username: string
  score: number
  diff: number
}

const players = ref<Player[]>([])

const sortedPlayers = computed(() => {
  return [...players.value].sort((a, b) => b.score - a.score)
})

const chatMessages = ref<any[]>([]) 
const wordChoices = ref<string[]>([])
const showTurnSummary = ref(false)
const showLeaderboard = ref(false) 
const turnResults = ref<TurnResult[]>([]) 
const isMyTurnToDraw = ref(false)

// UI State
const currentColor = ref('#000000')
const currentSize = ref(5)
const currentMode = ref<'drawing' | 'filling'>('drawing')

// Dende Instance
let dende: Dende | null = null

// --- Helper Functions ---

const addPlayerIfNeeded = (username: string) => {
  if (username && !players.value.find(p => p.username === username)) {
    players.value.push({ username, score: 0, guessed: false })
  }
}

const scrollToChatBottom = () => {
  nextTick(() => {
    if (chatBox.value) {
      chatBox.value.scrollTop = chatBox.value.scrollHeight
    }
  })
}

const pushSystemMessage = (content: string) => {
  chatMessages.value.push({
    from: 'System',
    content: content,
    isSystem: true
  })
  scrollToChatBottom()
}

// --- WebSocket Logic ---

const connect = () => {
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/matchmaking'
  socket.value = new WebSocket(wsUrl)
  socket.value.binaryType = "arraybuffer"

  socket.value.onopen = () => {
    console.log("Connected to Game Server! 🚀")
    isConnected.value = true
    statusMessage.value = "Waiting for players..."
  }

  socket.value.onmessage = async (event) => {
    try {
      const buffer = event.data as ArrayBuffer
      if (buffer.byteLength === 0) return

      const data = new Uint8Array(buffer)
      const type = data[data.length - 1]
      const payload = data.subarray(0, data.length - 1)

      switch (type) {
        case SERIAL_EVENT:
          handleEvent(payload)
          break
        case SERIAL_MESSAGE:
          handleMessage(payload)
          break
        case SERIAL_DRAWING:
          handleDrawingData(payload)
          break
        case SERIAL_TURN_SUMMARY:
          handleTurnSummary(payload)
          break
        case SERIAL_INITIAL_PLAYERS_AND_SCORES: // <--- Handle new type
          handleInitialPlayers(payload)
          break
        default:
          console.warn("Unknown serial type:", type)
      }
    } catch (err) {
      console.error("Error processing message:", err)
    }
  }

  socket.value.onclose = () => {
    isConnected.value = false
    statusMessage.value = "Disconnected."
  }
}

// --- Handlers ---

const handleEvent = (payload: Uint8Array) => {
  const event = Event.decode(payload)
  console.log('Event:', event.type, event.data)

  switch (event.type) {
    case EVENT_GAME_STARTED:
      statusMessage.value = 'Game started!'
      pushSystemMessage('Game started! 🚀')
      showTurnSummary.value = false 
      break

    case EVENT_PLAYER_JOINED:
      addPlayerIfNeeded(event.data)
      pushSystemMessage(`${event.data} joined!`)
      break

    case EVENT_PLAYER_RECONNECTED: 
      addPlayerIfNeeded(event.data)
      pushSystemMessage(`${event.data} reconnected.`)
      break

    case EVENT_PLAYER_LEFT:
      players.value = players.value.filter(p => p.username !== event.data)
      pushSystemMessage(`${event.data} left.`)
      break

    case EVENT_PlAYER_CHOOSING_WORD:
      addPlayerIfNeeded(event.data)
      statusMessage.value = `${event.data} is choosing...`
      isMyTurnToDraw.value = false
      dende?.disableDrawing()
      dende?.clear() 
      pushSystemMessage(`${event.data} is choosing a word...`)
      showTurnSummary.value = false 
      break

    case EVENT_PLEASE_CHOOSE_WORD:
      statusMessage.value = 'Your turn! Choose a word:'
      wordChoices.value = event.data.split(':')
      isMyTurnToDraw.value = true
      showTurnSummary.value = false 
      break

    case EVENT_PLAYER_STARTED_DRAWING:
      addPlayerIfNeeded(event.data)
      statusMessage.value = `${event.data} is drawing!`
      wordChoices.value = [] 
      dende?.clear() 

      if (isMyTurnToDraw.value) {
        dende?.enableDrawing()
        updateSettings() 
      } else {
        dende?.disableDrawing()
      }
      pushSystemMessage(`${event.data} is drawing!`)
      showTurnSummary.value = false 
      break

    case EVENT_PLAYER_HAS_GUESSED_THE_WORD:
      addPlayerIfNeeded(event.data)
      const p = players.value.find(p => p.username === event.data)
      if (p) p.guessed = true
      pushSystemMessage(`${event.data} guessed it! 🎉`)
      break

    case EVENT_LEADERBOARD: 
      statusMessage.value = "Game Over!"
      showLeaderboard.value = true
      showTurnSummary.value = false 
      dende?.disableDrawing()
      isMyTurnToDraw.value = false
      pushSystemMessage("Game Over! checking results...")
      break
  }
}

const handleMessage = (payload: Uint8Array) => {
  const msg = Message.decode(payload)
  addPlayerIfNeeded(msg.from)
  chatMessages.value.push({ ...msg, isSystem: false })
  scrollToChatBottom()
}

// New Handler for Initial Data Sync
const handleInitialPlayers = (payload: Uint8Array) => {
  const summary = TurnSummary.decode(payload)
  
  const newPlayers: Player[] = []
  summary.usernames.forEach((u: string, i: number) => {
    newPlayers.push({
      username: u,
      score: summary.scores[i],
      guessed: false
    })
  })

  // Overwrite local players with the authoritative list from server
  players.value = newPlayers
  console.log("Synced initial players and scores:", newPlayers)
}

const handleTurnSummary = (payload: Uint8Array) => {
  const summary = TurnSummary.decode(payload)
  
  const oldScores = new Map(players.value.map(p => [p.username, p.score]))
  
  const newPlayers: Player[] = []
  const results: TurnResult[] = []

  summary.usernames.forEach((u: string, i: number) => {
    const newScore = summary.scores[i]
    const oldScore = oldScores.get(u) || 0
    
    results.push({
      username: u,
      score: newScore,
      diff: newScore - oldScore
    })

    newPlayers.push({
      username: u,
      score: newScore,
      guessed: false
    })
  })

  players.value = newPlayers
  turnResults.value = results.sort((a, b) => b.score - a.score)
  
  showTurnSummary.value = true
  statusMessage.value = "Turn over!"
  dende.reset()
}

const handleDrawingData = (payload: Uint8Array) => {
  if (isMyTurnToDraw.value) return 

  const decoded = DrawingData.decode(payload)
  const part: IDendePart = {
    type: decoded.type as unknown as DendePartType,
    isLineEnd: decoded.isLineEnd,
    coordinates: decoded.coordinates,
    color: [
      decoded.color[0] * 255,
      decoded.color[1] * 255,
      decoded.color[2] * 255,
      decoded.color[3]
    ],
    lineWidth: decoded.lineWidth
  }
  
  dende?.putPart(part)
}

// --- Sending Data ---

const sendPart = (part: IDendePart) => {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) return

  const payload = DrawingData.create({
    type: part.type, 
    isLineEnd: part.isLineEnd,
    coordinates: part.coordinates,
    color: [
      part.color[0] / 255,
      part.color[1] / 255,
      part.color[2] / 255,
      part.color[3]
    ],
    lineWidth: part.lineWidth
  })

  const protoBytes = DrawingData.encode(payload).finish()
  const packet = new Uint8Array(protoBytes.length + 1)
  packet.set(protoBytes, 0)
  packet[protoBytes.length] = SERIAL_DRAWING 
  
  socket.value.send(packet)
}

const sendWordChoice = (index: number) => {
  if (!socket.value) return
  const msg = WordChoice.create({ wordIndex: index })
  const bytes = WordChoice.encode(msg).finish()
  
  const packet = new Uint8Array(bytes.length + 1)
  packet.set(bytes, 0)
  packet[bytes.length] = SERIAL_WORD_CHOICE
  socket.value.send(packet)
  
  wordChoices.value = []
}

const sendChatMessage = () => {
  if (!socket.value || !chatInput.value.trim()) return

  const msg = Message.create({ content: chatInput.value, from: '' })
  const bytes = Message.encode(msg).finish()
  
  const packet = new Uint8Array(bytes.length + 1)
  packet.set(bytes, 0)
  packet[bytes.length] = SERIAL_MESSAGE
  socket.value.send(packet)

  chatMessages.value.push({ from: 'You', content: chatInput.value, isSystem: false })
  chatInput.value = ''
  scrollToChatBottom()
}

const updateSettings = () => {
  if (!dende) return
  const hex = currentColor.value
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  dende.setLineColorRGBA(r, g, b, 1)
  dende.setLineWidth(currentSize.value)
  dende.setDrawingMode(currentMode.value)
}

// --- Dende Actions ---
const undo = () => dende?.undo()
const redo = () => dende?.redo()
const clear = () => dende?.clear() 

// --- Lifecycle ---

onMounted(() => {
  dende = new Dende(800, 600)
  
  if (dendeContainer.value) {
    dendeContainer.value.appendChild(dende.getHTMLElement())
  }

  dende.onPartCreated((part) => {
    if (isMyTurnToDraw.value) {
        sendPart(part)
    }
  })
  
  dende.disableDrawing() 
  updateSettings()
  connect()
})

onUnmounted(() => {
  socket.value?.close()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
    
    <div class="w-full max-w-7xl mb-4">
      <h2 class="text-xl font-bold text-center p-3 bg-gray-800 rounded-lg border-b-4 border-blue-600">
        {{ statusMessage }}
      </h2>
    </div>

    <div class="flex flex-col md:flex-row w-full max-w-7xl gap-4">
      
      <div class="w-full md:w-48 bg-gray-800 p-4 rounded-lg shadow-lg h-fit">
        <h3 class="text-lg font-bold mb-3 text-gray-400 uppercase tracking-wider">Players</h3>
        <ul class="space-y-2">
          <li v-for="player in sortedPlayers" :key="player.username" class="flex justify-between items-center bg-gray-700 p-2 rounded">
            <span :class="{ 'text-green-400 font-bold': player.guessed }">
              {{ player.username }}
              <span v-if="player.guessed">✓</span>
            </span>
            <span class="font-mono text-sm">{{ player.score }}</span>
          </li>
        </ul>
      </div>

      <div class="grow flex flex-col">
        <div class="relative rounded-lg overflow-hidden border-4 border-gray-700 bg-white">
          
          <div v-if="wordChoices.length > 0" class="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div class="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
              <h2 class="text-xl font-bold mb-4">Choose a word:</h2>
              <div class="flex gap-2 justify-center flex-wrap">
                <button
                  v-for="(word, index) in wordChoices"
                  :key="word"
                  @click="sendWordChoice(index)"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold transition"
                >
                  {{ word }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="showTurnSummary && !showLeaderboard" class="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div class="bg-gray-800 p-6 rounded-lg w-3/4 max-w-sm animate-in fade-in zoom-in duration-300">
              <h2 class="text-2xl font-bold text-center mb-4">Round Over!</h2>
              <ul class="space-y-2">
                <li v-for="result in turnResults" :key="result.username" class="flex justify-between p-2 bg-gray-700 rounded items-center">
                  <span>{{ result.username }}</span>
                  <div class="flex items-center gap-2">
                    <span v-if="result.diff > 0" class="text-green-400 font-bold text-sm">
                      +{{ result.diff }}
                    </span>
                    <span class="font-mono text-gray-300">{{ result.score }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="showLeaderboard" class="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div class="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-600 text-center animate-in fade-in zoom-in duration-500">
              <h1 class="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-yellow-600">
                🏆 GAME OVER 🏆
              </h1>
              <p class="text-gray-400 mb-6">Final Standings</p>
              
              <div class="space-y-3 mb-8">
                <div 
                  v-for="(player, index) in sortedPlayers.slice(0, 5)" 
                  :key="player.username" 
                  class="flex items-center justify-between p-3 rounded-lg transform transition hover:scale-105"
                  :class="{
                    'bg-yellow-900/40 border border-yellow-500/50': index === 0, // 1st Place Gold
                    'bg-gray-700/50 border border-gray-500/50': index === 1,    // 2nd Place Silver
                    'bg-orange-900/30 border border-orange-700/50': index === 2, // 3rd Place Bronze
                    'bg-gray-700/30': index > 2
                  }"
                >
                  <div class="flex items-center gap-3">
                    <span class="font-bold text-lg w-6" :class="{
                      'text-yellow-400': index === 0,
                      'text-gray-300': index === 1,
                      'text-orange-400': index === 2,
                      'text-gray-500': index > 2
                    }">
                      #{{ index + 1 }}
                    </span>
                    <span class="font-semibold text-white">{{ player.username }}</span>
                  </div>
                  <span class="font-mono font-bold text-xl">{{ player.score }} pts</span>
                </div>
              </div>

              <button 
                @click="router.push('/')" 
                class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition duration-200 shadow-lg"
              >
                Return to Home 🏠
              </button>
            </div>
          </div>

          <div 
            ref="dendeContainer" 
            style="line-height: 0;"
          ></div>
        </div>
        
        <div class="bg-gray-800 p-4 rounded-lg shadow-md mt-4 flex items-center gap-4" :class="{'opacity-50 pointer-events-none': !isMyTurnToDraw}">
          <input 
            type="color" 
            v-model="currentColor" 
            @change="updateSettings"
            class="w-10 h-10 bg-transparent cursor-pointer"
          >
          
          <div class="flex flex-col grow">
            <label class="text-xs text-gray-400">Size: {{ currentSize }}</label>
            <input 
              type="range" 
              v-model.number="currentSize" 
              @input="updateSettings" 
              min="1" max="20" 
              class="w-full accent-blue-500"
            >
          </div>
          
          <div class="flex bg-gray-700 rounded-lg p-1">
            <button 
              @click="() => { currentMode = 'drawing'; updateSettings() }"
              class="px-3 py-1 text-sm font-bold rounded transition"
              :class="currentMode === 'drawing' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'"
            >
              Draw
            </button>
            <button 
              @click="() => { currentMode = 'filling'; updateSettings() }"
              class="px-3 py-1 text-sm font-bold rounded transition"
              :class="currentMode === 'filling' ? 'bg-blue-600 text-white shadow' : 'text-gray-400'"
            >
              Fill
            </button>
          </div>

          <div class="border-l border-gray-600 pl-4 flex gap-2">
            <button @click="undo" class="p-2 text-gray-300 hover:bg-gray-700 rounded" title="Undo">↩️</button>
            <button @click="redo" class="p-2 text-gray-300 hover:bg-gray-700 rounded" title="Redo">↪️</button>
            <button @click="clear" class="p-2 text-red-400 hover:bg-red-900/30 rounded" title="Clear">🗑️</button>
          </div>
        </div>
      </div>

      <div class="w-full md:w-72 bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col h-[600px]">
        <h3 class="text-lg font-bold mb-3 text-gray-400 uppercase tracking-wider">Chat</h3>
        
        <div ref="chatBox" class="grow overflow-y-auto mb-3 space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-600">
          <div v-for="(msg, index) in chatMessages" :key="index" class="text-sm">
            <div v-if="msg.isSystem" class="text-center my-2">
              <span class="text-xs bg-gray-700 text-blue-300 px-2 py-1 rounded-full">{{ msg.content }}</span>
            </div>
            <div v-else>
              <span class="font-bold" :class="msg.from === 'You' ? 'text-yellow-400' : 'text-blue-400'">{{ msg.from }}:</span>
              <span class="text-gray-300 ml-1">{{ msg.content }}</span>
            </div>
          </div>
        </div>
        
        <form @submit.prevent="sendChatMessage" class="flex gap-2">
          <input
            v-model="chatInput"
            type="text"
            placeholder="Guess or chat..."
            class="grow px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
          />
          <button type="submit" class="bg-blue-600 px-3 rounded hover:bg-blue-500">➤</button>
        </form>
      </div>
      
    </div>
  </div>
</template>